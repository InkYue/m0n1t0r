use crate::web::{AppState, Error, Response, Result as WebResult, api::client::get_agent};
use actix_web::{
    HttpResponse, Responder, delete, get, put,
    web::{Bytes, Json, Path, Query},
};
use m0n1t0r_common::{
    client::Client as _,
    fs::Agent as _,
};
use serde::Deserialize;
use std::{
    net::SocketAddr,
    path::{Path as StdPath, PathBuf},
};

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Type {
    File,
    Directory,
}

#[derive(Deserialize, PartialEq)]
struct PathQuery {
    #[serde(rename = "type")]
    r#type: Type,
    path: PathBuf,
}

#[get("")]
pub async fn get(
    data: AppState,
    addr: Path<SocketAddr>,
    Query(query): Query<PathQuery>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, fs_agent)?;

    match query.r#type {
        Type::Directory => {
            if query.path == StdPath::new("/")
                && let Ok(drives) = agent.drives().await
            {
                Ok(HttpResponse::Ok().json(Response::success(drives)?))
            } else {
                Ok(HttpResponse::Ok().json(Response::success(agent.list(query.path).await?)?))
            }
        }
        Type::File => Ok(HttpResponse::Ok().body(agent.read(query.path).await?)),
    }
}

#[delete("")]
pub async fn delete(
    data: AppState,
    addr: Path<SocketAddr>,
    Query(query): Query<PathQuery>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, fs_agent)?;

    match query.r#type {
        Type::Directory => Ok(Json(Response::success(
            agent.remove_directory(query.path).await?,
        )?)),
        Type::File => Ok(Json(Response::success(
            agent.remove_file(query.path).await?,
        )?)),
    }
}

#[put("")]
pub async fn put(
    data: AppState,
    addr: Path<SocketAddr>,
    Query(query): Query<PathQuery>,
    payload: Bytes,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, fs_agent)?;

    match query.r#type {
        Type::Directory => Ok(Json(Response::success(
            agent.create_directory(query.path).await?,
        )?)),
        Type::File => Ok(Json(Response::success(
            agent.write(query.path, payload.to_vec()).await?,
        )?)),
    }
}

pub mod metadata {
    use super::*;

    #[get("/metadata")]
    pub async fn get(
        data: AppState,
        addr: Path<SocketAddr>,
        Query(query): Query<PathQuery>,
    ) -> WebResult<impl Responder> {
        let (agent, _) = get_agent!(data, &addr, fs_agent)?;

        match query.r#type {
            Type::Directory => Err(Error::Unimplemented),
            Type::File => Ok(Json(Response::success(agent.file(query.path).await?)?)),
        }
    }
}
