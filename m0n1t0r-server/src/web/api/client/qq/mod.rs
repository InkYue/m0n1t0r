pub mod friend;
pub mod url;

use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    Responder, get,
    web::{Json, Path},
};
use m0n1t0r_common::{
    client::Client as _,
    qq::Agent as _,
};
use std::net::SocketAddr;

#[get("")]
pub async fn get(
    data: AppState,
    addr: Path<SocketAddr>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, qq_agent)?;
    Ok(Json(Response::success(agent.list().await?)?))
}
