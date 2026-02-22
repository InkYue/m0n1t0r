use crate::web::{
    AppState, Response, Result as WebResult,
    api::{client::get_agent, global::proxy::*},
    error::Error,
};
use actix_web::{
    Responder, post,
    web::{Form, Json, Path},
};
use anyhow::anyhow;
use as_any::Downcast;
use m0n1t0r_common::{client::Client as _, proxy::{Agent, AgentClient}};
use remoc::chmux::ReceiverStream;
use serde::{Deserialize, Serialize};
use socks5_impl::{
    protocol::{Address, Reply},
    server::{
        AuthAdaptor, ClientConnection, IncomingConnection, Server,
        auth::{NoAuth, UserKeyAuth},
    },
};
use std::{net::SocketAddr, sync::Arc};
use tokio::{
    io,
    net::{self},
    select,
};
use tokio_util::{
    io::{CopyToBytes, SinkWriter, StreamReader},
    sync::CancellationToken,
};

pub mod pass {
    pub use super::*;

    #[derive(Serialize, Deserialize, PartialEq)]
    struct PasswordAuthForm {
        from: SocketAddr,
        name: String,
        password: String,
    }

    #[post("/socks5/pass")]
    pub async fn post(
        data: AppState,
        addr: Path<SocketAddr>,
        Form(form): Form<PasswordAuthForm>,
    ) -> WebResult<impl Responder> {
        let auth = Arc::new(UserKeyAuth::new(&form.name, &form.password));
        let addr = open(data, &addr, "0.0.0.0:0".parse().unwrap(), auth).await?;

        Ok(Json(Response::success(addr)?))
    }
}

pub mod noauth {
    pub use super::*;

    #[derive(Serialize, Deserialize, PartialEq)]
    struct NoAuthForm {
        from: SocketAddr,
    }

    #[post("/socks5/noauth")]
    pub async fn post(
        data: AppState,
        addr: Path<SocketAddr>,
        Form(form): Form<NoAuthForm>,
    ) -> WebResult<impl Responder> {
        let auth = Arc::new(NoAuth);
        let addr = open(data, &addr, form.from, auth).await?;

        Ok(Json(Response::success(addr)?))
    }
}

pub async fn open_internal<O>(
    data: AppState,
    addr: &SocketAddr,
    from: SocketAddr,
    auth: AuthAdaptor<O>,
) -> WebResult<(SocketAddr, CancellationToken, CancellationToken)>
where
    O: 'static + Sync + Send,
{
    let (agent, connection_canceller) = get_agent!(data, addr, proxy_agent)?;
    let connection_canceller_clone = connection_canceller.clone();
    let agent: Arc<AgentClient> = Arc::new(agent);

    let listener = Server::bind(from, auth).await?;
    let addr = listener.local_addr()?;
    let session_canceller = CancellationToken::new();
    let session_canceller_clone = session_canceller.clone();

    tokio::spawn(async move {
        loop {
            let agent = agent.clone();
            select! {
                accepted = listener.accept() => {
                    let (conn, _) = accepted?;
                    tokio::spawn(handle(conn, agent, connection_canceller_clone.clone(), session_canceller_clone.clone()));
                },
                _ = connection_canceller_clone.cancelled() => break,
                _ = session_canceller_clone.cancelled() => break,
            }
        }
        Ok::<_, Error>(())
    });
    Ok((addr, connection_canceller, session_canceller))
}

pub async fn open<O>(
    data: AppState,
    addr: &SocketAddr,
    from: SocketAddr,
    auth: AuthAdaptor<O>,
) -> WebResult<SocketAddr>
where
    O: 'static + Sync + Send,
{
    let (from, connection_canceller, session_canceller) =
        open_internal(data, addr, from, auth).await?;
    let session_canceller_clone = session_canceller.clone();
    let key = PROXY_MAP.write().await.insert(Proxy::new(
        Type::Socks5((from, addr).into()),
        session_canceller_clone,
    ));

    tokio::spawn(async move {
        select! {
            _ = connection_canceller.cancelled() => {},
            _ = session_canceller.cancelled() => {},
        }
        PROXY_MAP.write().await.remove(key);
        Ok::<_, Error>(())
    });

    Ok(from)
}

async fn handle<S>(
    conn: IncomingConnection<S>,
    agent: Arc<AgentClient>,
    canceller_global: CancellationToken,
    canceller_scoped: CancellationToken,
) -> WebResult<()>
where
    S: Send + Sync + 'static,
{
    let (conn, auth) = conn.authenticate().await?;

    if let Some(auth) = auth.downcast_ref::<std::io::Result<bool>>() {
        match auth {
            Ok(b) => {
                if !(*b) {
                    return Err(Error::Forbidden(serde_error::Error::new(&*anyhow!(
                        "password or username mismatch"
                    ))));
                }
            }
            Err(e) => return Err(Error::Forbidden(serde_error::Error::new(e))),
        }
    }

    match conn.wait_request().await? {
        // TODO: Implement this
        ClientConnection::UdpAssociate(associate, _) => {
            let mut conn = associate
                .reply(Reply::CommandNotSupported, Address::unspecified())
                .await?;
            conn.shutdown().await?;
        }
        // TODO: Implement this
        ClientConnection::Bind(bind, _) => {
            let mut conn = bind
                .reply(Reply::CommandNotSupported, Address::unspecified())
                .await?;
            conn.shutdown().await?;
        }
        ClientConnection::Connect(connect, addr) => {
            let addr: SocketAddr = match addr {
                Address::DomainAddress(domain, port) => net::lookup_host((domain, port))
                    .await?
                    .next()
                    .ok_or(anyhow!("dns lookup failed"))?,
                Address::SocketAddress(addr) => addr,
            };
            let (tx, rx) = agent.connect(addr).await?;
            let mut rx = StreamReader::new(ReceiverStream::new(rx.into_inner().await?));
            let mut tx = SinkWriter::new(CopyToBytes::new(tx.into_inner().await?.into_sink()));
            let mut conn = connect
                .reply(Reply::Succeeded, Address::unspecified())
                .await?;
            let (mut conn_rx, mut conn_tx) = conn.split();

            select! {
                _ = io::copy(&mut rx, &mut conn_tx) => {},
                _ = io::copy(&mut conn_rx, &mut tx) => {},
                _ = canceller_global.cancelled() => {},
                _ = canceller_scoped.cancelled() => {},
            };
        }
    }
    Ok(())
}
