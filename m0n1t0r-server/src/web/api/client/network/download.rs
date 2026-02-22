use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    Responder, post,
    web::{Form, Json, Path},
};
use m0n1t0r_common::{client::Client as _, network::Agent as _};
use serde::Deserialize;
use std::{net::SocketAddr, path::PathBuf};
use url::Url;

#[derive(Deserialize)]
struct DownloadForm {
    url: Url,
    path: PathBuf,
}

#[post("/download")]
pub async fn post(
    data: AppState,
    addr: Path<SocketAddr>,
    Form(form): Form<DownloadForm>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, network_agent)?;

    Ok(Json(Response::success(
        agent.download(form.url, form.path).await?,
    )?))
}
