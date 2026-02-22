use crate::web::{AppState, Error, Response, Result as WebResult};
use actix_web::{
    Responder, get,
    web::{Json, Path},
};
use m0n1t0r_common::client::Client as _;
use std::net::SocketAddr;

#[get("/environments")]
pub async fn get(
    data: AppState,
    addr: Path<SocketAddr>,
) -> WebResult<impl Responder> {
    let lock_map = &data.read().await.map;
    let server = lock_map.get(&addr).ok_or(Error::NotFound)?;

    let lock_obj = server.read().await;
    let client = lock_obj.client()?;

    Ok(Json(Response::success(client.environment().await?)?))
}
