use crate::web::{AppState, Error, Result as WebResult, api::client::get_agent, util};
use actix_web::{
    HttpRequest, Responder, get,
    web::{Path, Payload, Query},
};
use actix_ws::Message;
use anyhow::{anyhow, bail};
use core::slice;
use ffmpeg_next::{Packet, Rational, codec, format::Pixel, frame::Video};
use hbb_common::{
    message_proto::{VideoFrame, video_frame::Union::Vp9s},
    protobuf::Message as _,
};
use m0n1t0r_common::{client::Client as _, rd::Agent as _};
use rayon::{
    iter::{IndexedParallelIterator, ParallelIterator},
    prelude::{ParallelSlice, ParallelSliceMut},
};
use scrap::{
    CodecFormat, GoogleImage, ImageFormat, ImageRgb, ImageTexture, VpxDecoder, VpxDecoderConfig,
    VpxVideoCodecId, codec::Decoder,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tokio::{select, task};

const DEFAULT_FRAME_RATE: i32 = 25;
const YUV_PLANE_COUNT: usize = 3;

#[derive(Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Format {
    Raw,
    Abgr,
    Argb,
}

#[derive(Deserialize)]
struct RdQuery {
    display: usize,
    quality: f32,
    kf: Option<usize>,
    format: Option<Format>,
}

/// # Safety
/// `src_ptr` must be valid for reads of `src_stride * height` bytes.
/// `dst` must have length >= `dst_stride * height`.
unsafe fn copy_plane(
    src_ptr: *const u8,
    src_stride: usize,
    dst: &mut [u8],
    dst_stride: usize,
    height: usize,
) {
    // SAFETY: Caller guarantees src_ptr is valid for src_stride * height bytes
    // and dst has sufficient length.
    unsafe {
        slice::from_raw_parts(src_ptr, src_stride * height)
            .par_chunks(src_stride)
            .zip(dst.par_chunks_mut(dst_stride))
            .for_each(|(src, dst)| {
                dst.copy_from_slice(&src[..dst_stride]);
            });
    }
}

#[get("/stream/mpeg1video")]
pub async fn get_mpeg1video(
    data: AppState,
    addr: Path<SocketAddr>,
    query: Query<RdQuery>,
    req: HttpRequest,
    body: Payload,
) -> WebResult<impl Responder> {
    let query = query.into_inner();
    let (agent, canceller) = get_agent!(data, &addr, rd_agent)?;

    let display = agent
        .displays()
        .await?
        .into_iter()
        .nth(query.display)
        .ok_or(Error::NotFound)?;
    let mut rx = agent.view(display.clone(), query.quality, query.kf).await?;

    let (response, mut session, mut stream) = actix_ws::handle(&req, body)?;

    task::spawn_local(util::handle_websocket(session.clone(), async move {
        let mut decoder = VpxDecoder::new(VpxDecoderConfig {
            codec: VpxVideoCodecId::VP9,
        })?;
        let codec = ffmpeg_next::encoder::find(codec::Id::MPEG1VIDEO)
            .ok_or(ffmpeg_next::Error::EncoderNotFound)?;
        let mut encoder = codec::Context::new_with_codec(codec).encoder().video()?;
        encoder.set_width(display.width as u32);
        encoder.set_height(display.height as u32);
        encoder.set_format(Pixel::YUV420P);
        encoder.set_frame_rate(Some(Rational(DEFAULT_FRAME_RATE, 1)));
        encoder.set_time_base(Rational(1, DEFAULT_FRAME_RATE));
        encoder.set_max_b_frames(0);
        let mut encoder = encoder.open_as(codec)?;
        let mut frame_count = 0u64;
        let mut video_frame = Video::new(
            encoder.format(),
            display.width as u32,
            display.height as u32,
        );
        let mut ts_muxer = super::ts_mux::TsMuxer::new();

        // Send initial PAT + PMT so the client demuxer can identify the stream
        session.binary(ts_muxer.generate_header()).await?;

        loop {
            select! {
                Some(msg) = stream.recv() => match msg? {
                    Message::Ping(bytes) => session.pong(&bytes).await?,
                    Message::Close(_) => break,
                    _ => {}
                },
                received = rx.recv() => {
                    let video_frame_proto =
                        VideoFrame::parse_from_bytes(received?.ok_or(anyhow!("channel closed"))?.as_slice())?;
                    if let Some(Vp9s(evfs)) = video_frame_proto.union {
                        for evf in evfs.frames {
                            for frame in decoder.decode(&evf.data)? {
                                let src_planes = frame.planes();
                                let src_strides = frame.stride();
                                let heights = [display.height, display.height / 2, display.height / 2];
                                let dst_strides = [video_frame.stride(0), video_frame.stride(1), video_frame.stride(2)];
                                for i in 0..YUV_PLANE_COUNT {
                                    // SAFETY: src_planes[i] points to decoder output valid for
                                    // src_strides[i] * heights[i] bytes; video_frame.data_mut(i)
                                    // is allocated by ffmpeg with sufficient size.
                                    unsafe {
                                        copy_plane(
                                            src_planes[i],
                                            src_strides[i] as usize,
                                            video_frame.data_mut(i),
                                            dst_strides[i],
                                            heights[i],
                                        );
                                    }
                                }
                                video_frame.set_pts(Some(frame_count as i64));
                                encoder.send_frame(&video_frame)?;
                                let mut encoded = Packet::empty();
                                while encoder.receive_packet(&mut encoded).is_ok() {
                                    let pts_90k = frame_count * 90000 / DEFAULT_FRAME_RATE as u64;
                                    let mut ts_data = Vec::new();
                                    // Resend PAT+PMT periodically for robustness
                                    if frame_count % 30 == 0 {
                                        ts_data.extend_from_slice(&ts_muxer.generate_header());
                                    }
                                    ts_data.extend_from_slice(
                                        &ts_muxer.mux_video(
                                            encoded.data().ok_or(Error::NotFound)?,
                                            pts_90k,
                                        ),
                                    );
                                    session.binary(ts_data).await?;
                                }
                                frame_count += 1;
                            }
                        }
                    } else {
                        bail!("unsupported video frame type");
                    }
                },
                _ = canceller.cancelled() => break,
            }
        }
        Ok::<_, anyhow::Error>(())
    }));

    Ok(response)
}

#[get("/stream/yuv")]
pub async fn get_yuv(
    data: AppState,
    addr: Path<SocketAddr>,
    query: Query<RdQuery>,
    req: HttpRequest,
    body: Payload,
) -> WebResult<impl Responder> {
    let query = query.into_inner();
    let (agent, canceller) = get_agent!(data, &addr, rd_agent)?;

    let display = agent
        .displays()
        .await?
        .into_iter()
        .nth(query.display)
        .ok_or(Error::NotFound)?;
    let mut rx = agent.view(display.clone(), query.quality, query.kf).await?;

    let (response, mut session, mut stream) = actix_ws::handle(&req, body)?;

    task::spawn_local(util::handle_websocket(session.clone(), async move {
        let mut decoder = VpxDecoder::new(VpxDecoderConfig {
            codec: VpxVideoCodecId::VP9,
        })?;

        loop {
            select! {
                Some(msg) = stream.recv() => match msg? {
                    Message::Ping(bytes) => session.pong(&bytes).await?,
                    Message::Close(_) => break,
                    _ => {}
                },
                received = rx.recv() => {
                    let video_frame =
                        VideoFrame::parse_from_bytes(received?.ok_or(anyhow!("channel closed"))?.as_slice())?;
                    if let Some(Vp9s(evfs)) = video_frame.union {
                        for evf in evfs.frames {
                            for frame in decoder.decode(&evf.data)? {
                                let pixels = display.width * display.height;
                                let heights = [display.height, display.height / 2, display.height / 2];
                                let src_planes = frame.planes();
                                let src_strides = frame.stride();
                                let mut buffer = vec![0; pixels * 3 / 2];
                                let dst_strides = [display.width, display.width / 2, display.width / 2];
                                let (dst_planes_1, dst_planes_12) = buffer.split_at_mut(pixels);
                                let (dst_planes_2, dst_planes_3) = dst_planes_12.split_at_mut(pixels / 4);
                                let dst_planes = [dst_planes_1, dst_planes_2, dst_planes_3];
                                for i in 0..YUV_PLANE_COUNT {
                                    // SAFETY: src_planes[i] points to decoder output valid for
                                    // src_strides[i] * heights[i] bytes; dst_planes[i] is a
                                    // sub-slice of buffer with sufficient size.
                                    unsafe {
                                        copy_plane(
                                            src_planes[i],
                                            src_strides[i] as usize,
                                            dst_planes[i],
                                            dst_strides[i],
                                            heights[i],
                                        );
                                    }
                                }
                                session.binary(buffer).await?;
                            }
                        }
                    } else {
                        bail!("unsupported video frame type");
                    }
                },
                _ = canceller.cancelled() => break,
            }
        }
        Ok::<_, anyhow::Error>(())
    }));

    Ok(response)
}

#[get("/stream/rgb")]
pub async fn get_rgb(
    data: AppState,
    addr: Path<SocketAddr>,
    query: Query<RdQuery>,
    req: HttpRequest,
    body: Payload,
) -> WebResult<impl Responder> {
    let query = query.into_inner();
    let (agent, canceller) = get_agent!(data, &addr, rd_agent)?;

    let display = agent
        .displays()
        .await?
        .into_iter()
        .nth(query.display)
        .ok_or(Error::NotFound)?;
    let mut rx = agent.view(display.clone(), query.quality, query.kf).await?;

    let (response, mut session, mut stream) = actix_ws::handle(&req, body)?;

    task::spawn_local(util::handle_websocket(session.clone(), async move {
        let mut decoder = Decoder::new(CodecFormat::VP9, None);
        let mut pixelbuffer = true;
        let mut chroma = None;
        let mut rgb = ImageRgb::new(
            match query.format.ok_or(Error::NotFound)? {
                Format::Raw => ImageFormat::Raw,
                Format::Abgr => ImageFormat::ABGR,
                Format::Argb => ImageFormat::ARGB,
            },
            1,
        );
        let mut texture = ImageTexture::default();

        loop {
            select! {
                Some(msg) = stream.recv() => match msg? {
                    Message::Ping(bytes) => session.pong(&bytes).await?,
                    Message::Close(_) => break,
                    _ => {}
                },
                received = rx.recv() => {
                    let video_frame =
                        VideoFrame::parse_from_bytes(received?.ok_or(anyhow!("channel closed"))?.as_slice())?;
                    if let Some(frame) = video_frame.union {
                        decoder.handle_video_frame(
                            &frame,
                            &mut rgb,
                            &mut texture,
                            &mut pixelbuffer,
                            &mut chroma,
                        )?;

                        if pixelbuffer {
                            session.binary(rgb.raw.to_vec()).await?;
                        }
                    }
                },
                _ = canceller.cancelled() => break,
            }
        }
        Ok::<_, anyhow::Error>(())
    }));

    Ok(response)
}
