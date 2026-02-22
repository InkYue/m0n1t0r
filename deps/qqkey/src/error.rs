pub type Result<T> = std::result::Result<T, Error>;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, Clone)]
pub enum NetworkError {
    #[error("http request failed: {0}")]
    HttpRequest(serde_error::Error),

    #[error("invalid url: {0}")]
    InvalidUrl(serde_error::Error),

    #[error("invalid url: no query")]
    UrlNoQuery,

    #[error("invalid url: no domain")]
    UrlNoDomain,
}

#[derive(Error, Debug, Serialize, Deserialize, Clone)]
pub enum ParseError {
    #[error("build regex failed: {0}")]
    Regex(serde_error::Error),

    #[error("regex no match")]
    RegexNoMatch(String),

    #[error("parse int failed: {0}")]
    InvalidInt(serde_error::Error),

    #[error("invalid character")]
    InvalidCharacter,

    #[error("invalid utf8 string")]
    InvalidUtf8(serde_error::Error),

    #[error("serialization failed: {0}")]
    Serialize(serde_error::Error),
}

#[derive(Error, Debug, Serialize, Deserialize, Clone)]
pub enum DataError {
    #[error("cookie store lock poisoned: {0}")]
    CookieStoreLockPoisoned(serde_error::Error),

    #[error("cookie not found: {0}")]
    CookieNotFound(String),

    #[error("field not found: {0}")]
    FieldNotFound(String),
}

#[derive(Error, Debug, Serialize, Deserialize, Clone)]
pub enum Error {
    #[error(transparent)]
    Network(NetworkError),

    #[error(transparent)]
    Parse(ParseError),

    #[error(transparent)]
    Data(DataError),

    #[error("request qq failed")]
    RequestQQ,
}

impl Error {
    pub fn cookie_not_found(name: impl Into<String>) -> Self {
        Self::Data(DataError::CookieNotFound(name.into()))
    }

    pub fn field_not_found(name: impl Into<String>) -> Self {
        Self::Data(DataError::FieldNotFound(name.into()))
    }

    pub fn regex_no_match(context: impl Into<String>) -> Self {
        Self::Parse(ParseError::RegexNoMatch(context.into()))
    }
}

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        Self::Network(NetworkError::HttpRequest(serde_error::Error::new(&e)))
    }
}

impl From<regex::Error> for Error {
    fn from(e: regex::Error) -> Self {
        Self::Parse(ParseError::Regex(serde_error::Error::new(&e)))
    }
}

impl From<std::num::ParseIntError> for Error {
    fn from(e: std::num::ParseIntError) -> Self {
        Self::Parse(ParseError::InvalidInt(serde_error::Error::new(&e)))
    }
}

impl From<std::sync::PoisonError<std::sync::RwLockReadGuard<'_, reqwest_cookie_store::CookieStore>>>
    for Error
{
    fn from(
        e: std::sync::PoisonError<
            std::sync::RwLockReadGuard<'_, reqwest_cookie_store::CookieStore>,
        >,
    ) -> Self {
        Self::Data(DataError::CookieStoreLockPoisoned(
            serde_error::Error::new(&e),
        ))
    }
}

impl From<url::ParseError> for Error {
    fn from(e: url::ParseError) -> Self {
        Self::Network(NetworkError::InvalidUrl(serde_error::Error::new(&e)))
    }
}

impl From<std::string::FromUtf8Error> for Error {
    fn from(e: std::string::FromUtf8Error) -> Self {
        Self::Parse(ParseError::InvalidUtf8(serde_error::Error::new(&e)))
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Self::Parse(ParseError::Serialize(serde_error::Error::new(&e)))
    }
}
