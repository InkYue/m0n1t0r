use crate::web::Error;
use actix_multipart::form::MultipartFormConfig;
use actix_web::web::{FormConfig, JsonConfig, PathConfig, QueryConfig};
use actix_ws::{CloseCode, Session};
use log::warn;
use std::future::Future;

const MULTIPART_TOTAL_LIMIT: usize = 0x6400000; // 100 MB
const MULTIPART_MEMORY_LIMIT: usize = 0x3200000; // 50 MB

pub fn extractor_config() -> (
    PathConfig,
    QueryConfig,
    FormConfig,
    MultipartFormConfig,
    JsonConfig,
) {
    (
        PathConfig::default().error_handler(|error, _| Error::from(error).into()),
        QueryConfig::default().error_handler(|error, _| Error::from(error).into()),
        FormConfig::default().error_handler(|error, _| Error::from(error).into()),
        MultipartFormConfig::default()
            .total_limit(MULTIPART_TOTAL_LIMIT)
            .memory_limit(MULTIPART_MEMORY_LIMIT)
            .error_handler(|error, _| Error::from(error).into()),
        JsonConfig::default().error_handler(|error, _| Error::from(error).into()),
    )
}

pub async fn handle_websocket<F, E>(session: Session, future: F)
where
    F: Future<Output = std::result::Result<(), E>> + 'static,
    E: std::fmt::Display,
{
    let _ = match future.await {
        Ok(_) => session.close(None).await,
        Err(e) => {
            warn!("websocket error: {}", e);
            session
                .close(Some((CloseCode::Abnormal, e.to_string()).into()))
                .await
        }
    };
}
