pub mod execute;
pub mod interactive;
pub mod voidgate;

use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    Responder, delete, get,
    web::{Json, Path, Query},
};
use m0n1t0r_common::{
    client::Client as _,
    process::Agent as _,
};
use serde::Deserialize;
use std::net::SocketAddr;

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Type {
    Pid,
    Name,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Execute {
    Blocked,
    Detached,
}

impl Default for Execute {
    fn default() -> Self {
        Self::Blocked
    }
}

#[derive(Deserialize)]
struct CommandForm {
    command: String,
    #[serde(default)]
    option: Execute,
}

#[derive(Deserialize)]
struct ProcessQuery {
    #[serde(rename = "type")]
    r#type: Type,
}

#[get("")]
pub async fn all(
    data: AppState,
    addr: Path<SocketAddr>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, process_agent)?;

    Ok(Json(Response::success(agent.list().await?)?))
}

#[delete("/{value}")]
pub async fn delete(
    data: AppState,
    path: Path<(SocketAddr, String)>,
    Query(query): Query<ProcessQuery>,
) -> WebResult<impl Responder> {
    let (addr, value) = path.into_inner();
    let (agent, _) = get_agent!(data, &addr, process_agent)?;

    let processes = match query.r#type {
        Type::Pid => agent.kill_by_id(value.parse()?).await,
        Type::Name => agent.kill_by_name(value).await,
    }?;

    Ok(Json(Response::success(processes)?))
}
