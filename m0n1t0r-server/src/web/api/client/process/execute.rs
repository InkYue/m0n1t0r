use crate::web::{
    AppState, Response, Result as WebResult,
    api::client::{get_agent, process::{CommandForm, Execute}},
};
use actix_web::{
    Responder, post,
    web::{Form, Json, Path},
};
use m0n1t0r_common::{client::Client as _, process::Agent as _};
use std::net::SocketAddr;

#[post("/execute")]
pub async fn post(
    data: AppState,
    addr: Path<SocketAddr>,
    Form(form): Form<CommandForm>,
) -> WebResult<impl Responder> {
    let (agent, _) = get_agent!(data, &addr, process_agent)?;

    let mut command = shell_words::split(&form.command)?;
    let program = command.remove(0);

    match form.option {
        Execute::Blocked => Ok(Json(Response::success(
            agent.execute(program, command).await?,
        )?)),
        Execute::Detached => Ok(Json(Response::success(
            agent.execute_detached(program, command).await?,
        )?)),
    }
}
