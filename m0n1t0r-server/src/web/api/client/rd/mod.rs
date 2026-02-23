pub mod stream;
mod ts_mux;

use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    Responder, get,
    web::{Json, Path},
};
use m0n1t0r_common::{
    client::Client as _,
    rd::Agent as _,
};
use std::net::SocketAddr;

#[get("")]
pub async fn all(
    data: AppState,
    addr: Path<SocketAddr>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, rd_agent)?;

    Ok(Json(Response::success(agent.displays().await?)?))
}
