use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    Responder, get,
    web::{Json, Path},
};
use m0n1t0r_common::{client::Client as _, qq::Agent as _};
use std::net::SocketAddr;

#[get("/{id}/friends")]
pub async fn get(
    data: AppState,
    path: Path<(SocketAddr, i64)>,
) -> WebResult<impl Responder> {
    let (addr, id) = path.into_inner();
    let (agent, _) = get_agent!(data, &addr, qq_agent)?;

    Ok(Json(Response::success(agent.friends(id).await?)?))
}
