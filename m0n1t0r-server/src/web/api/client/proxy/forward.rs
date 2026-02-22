use crate::web::{
    AppState, Response, Result as WebResult,
    api::{client::get_agent, global::proxy::*},
    error::Error,
};
use actix_web::{
    Responder, post,
    web::{Form, Json, Path},
};
use anyhow::anyhow;
use m0n1t0r_common::{client::Client as _, proxy::Agent as _};
use remoc::chmux::ReceiverStream;
use serde::Deserialize;
use std::{net::SocketAddr, sync::Arc};
use tokio::{io, net::TcpStream, select};
use tokio_util::{
    io::{CopyToBytes, SinkWriter, StreamReader},
    sync::CancellationToken,
};

#[derive(Deserialize)]
struct ForwardForm {
    from: SocketAddr,
    to: SocketAddr,
}

#[post("/forward")]
pub async fn post(
    data: AppState,
    addr: Path<SocketAddr>,
    Form(form): Form<ForwardForm>,
) -> WebResult<impl Responder> {
    Ok(Json(Response::success(
        open(data, &addr, form.from, form.to).await?,
    )?))
}

pub async fn open_internal(
    data: AppState,
    addr: &SocketAddr,
    from: SocketAddr,
    to: SocketAddr,
) -> WebResult<(CancellationToken, CancellationToken)> {
    let (agent, connection_canceller) = get_agent!(data, addr, proxy_agent)?;
    let connection_canceller_clone = connection_canceller.clone();
    let agent = Arc::new(agent);

    let (mut my_rx, mut canceller_tx) = agent.forward(to).await?;
    let session_canceller = CancellationToken::new();
    let session_canceller_clone = session_canceller.clone();

    tokio::spawn(async move {
        loop {
            select! {
                received = my_rx.recv() => {
                    let (tx, rx, _) = received?.ok_or(anyhow!("forward is invalid"))?;
                    let (mut stream_rx, mut stream_tx) = TcpStream::connect(from).await?.into_split();

                    tokio::spawn(async move {
                        let mut rx = StreamReader::new(ReceiverStream::new(rx.into_inner().await?));
                        let mut tx = SinkWriter::new(CopyToBytes::new(tx.into_inner().await?.into_sink()));

                        select! {
                            _ = io::copy(&mut rx, &mut stream_tx) => {},
                            _ = io::copy(&mut stream_rx, &mut tx) => {},
                        }
                        Ok::<_, Error>(())
                    });
                },
                _ = connection_canceller_clone.cancelled() => break,
                _ = session_canceller_clone.cancelled() => break,
            }
        }
        canceller_tx.send(()).await?;
        Ok::<_, anyhow::Error>(())
    });
    Ok((connection_canceller, session_canceller))
}

pub async fn open(
    data: AppState,
    addr: &SocketAddr,
    from: SocketAddr,
    to: SocketAddr,
) -> WebResult<()> {
    let (connection_canceller, session_canceller) = open_internal(data, addr, from, to).await?;
    let session_canceller_clone = session_canceller.clone();
    let key = PROXY_MAP.write().await.insert(Proxy::new(
        Type::Forward((from, to, addr).into()),
        session_canceller_clone,
    ));

    tokio::spawn(async move {
        select! {
            _ = connection_canceller.cancelled() => {},
            _ = session_canceller.cancelled() => {},
        }
        PROXY_MAP.write().await.remove(key);
        Ok::<_, Error>(())
    });

    Ok(())
}
