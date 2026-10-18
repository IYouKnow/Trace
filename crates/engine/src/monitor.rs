//! Monitor enumeration and selection.
//!
//! Capture is always of a whole display; these helpers list the available
//! monitors and turn a stored selection back into a capturable [`Monitor`].

use anyhow::{anyhow, Result};
use serde::Serialize;
use windows_capture::monitor::Monitor;

/// A selectable display, described for the UI.
#[derive(Debug, Clone, Serialize)]
pub struct MonitorInfo {
    /// Stable id (`Monitor::device_name()`, e.g. `\\.\DISPLAY1`).
    pub id: String,
    /// Friendly name (`Monitor::name()`), falling back to the id.
    pub name: String,
    pub width: u32,
    pub height: u32,
    /// One-based index, matching display order.
    pub index: usize,
    /// Whether this is the primary monitor.
    pub is_primary: bool,
}

/// Lists every active monitor, marking the primary one.
pub fn list_monitors() -> Result<Vec<MonitorInfo>> {
    let primary = Monitor::primary().ok();
    let monitors = Monitor::enumerate()?;

    Ok(monitors
        .into_iter()
        .map(|monitor| {
            let id = monitor.device_name().unwrap_or_default();
            let name = monitor.name().unwrap_or_else(|_| id.clone());
            MonitorInfo {
                name: if name.is_empty() { id.clone() } else { name },
                id,
                width: monitor.width().unwrap_or(0),
                height: monitor.height().unwrap_or(0),
                index: monitor.index().unwrap_or(0),
                is_primary: primary == Some(monitor),
            }
        })
        .collect())
}

/// Resolves a stored monitor id to a capture target.
///
/// Prefers an exact `device_name` match and falls back to the primary monitor
/// when the id is absent or no longer attached (unplugged or reordered).
pub fn resolve(id: Option<&str>) -> Result<Monitor> {
    let monitors = Monitor::enumerate().unwrap_or_default();

    if let Some(id) = id {
        if let Some(found) = monitors
            .iter()
            .find(|monitor| monitor.device_name().map(|name| name == id).unwrap_or(false))
        {
            return Ok(*found);
        }
    }

    if let Ok(primary) = Monitor::primary() {
        return Ok(primary);
    }

    monitors
        .into_iter()
        .next()
        .ok_or_else(|| anyhow!("no monitors available"))
}
