//! Persisted user settings (`settings.json` in the app config directory).

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::Settings;

/// `<app config dir>/settings.json`.
fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
    Ok(dir.join("settings.json"))
}

/// Reads stored settings, falling back to defaults when absent or unreadable.
pub fn load(app: &AppHandle) -> Settings {
    let Ok(path) = config_path(app) else {
        return Settings::default();
    };
    let Ok(contents) = fs::read_to_string(&path) else {
        return Settings::default();
    };
    match serde_json::from_str(&contents) {
        Ok(settings) => settings,
        Err(error) => {
            // Never drop a user's configuration silently: keep the unreadable file
            // beside the fresh one so it can be recovered, and fall back to defaults.
            eprintln!(
                "settings: {} could not be read ({error}); keeping it as a .bak and using defaults",
                path.display()
            );
            let _ = fs::rename(&path, path.with_extension("json.bak"));
            Settings::default()
        }
    }
}

/// Writes settings to disk, creating the config directory if needed.
pub fn persist(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(&path, json).map_err(|error| error.to_string())
}
