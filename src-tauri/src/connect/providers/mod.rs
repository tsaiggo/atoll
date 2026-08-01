mod windows_gsmtc;

use super::provider::ConnectProvider;

pub(crate) fn builtins() -> Vec<Box<dyn ConnectProvider>> {
    vec![Box::new(windows_gsmtc::WindowsGsmtcProvider)]
}
