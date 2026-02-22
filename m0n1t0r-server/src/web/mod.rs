pub mod api;
mod error;
mod response;
mod util;

pub use error::*;
pub use response::Response;

use crate::ServerMap;
use actix_web::web::Data;
use std::sync::Arc;
use tokio::sync::RwLock;

pub type AppState = Data<Arc<RwLock<ServerMap>>>;
