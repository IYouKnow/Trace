//! Top-level window enumeration and selection.
//!
//! Capture can target a single window instead of a whole display. These helpers
//! list the windows a user can pick from (by app) and turn a stored selection
//! back into a capturable [`Window`].

use anyhow::{anyhow, Result};
use serde::Serialize;
use windows_capture::window::Window;

use crate::icon;

/// A selectable window, described for the UI.
#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    /// Identity for the current session (`pid:hwnd`); not stable across restarts.
    pub id: String,
    pub title: String,
    /// Owning process image name (e.g. `chrome.exe`), or `"Unknown"`.
    pub app: String,
    pub pid: u32,
    pub width: u32,
    pub height: u32,
    /// Whether this is the window currently in the foreground.
    pub is_foreground: bool,
    /// PNG bytes for the app's icon, if it could be extracted.
    pub icon_png: Option<Vec<u8>>,
}

/// Lists every capturable window, foreground first, grouped-friendly by app.
pub fn list_windows() -> Result<Vec<WindowInfo>> {
    let foreground = Window::foreground().ok();
    let own_pid = std::process::id();

    let mut windows: Vec<WindowInfo> = Window::enumerate()?
        .into_iter()
        .filter_map(|window| describe(window, foreground, own_pid))
        .collect();

    windows.sort_by(|a, b| {
        b.is_foreground
            .cmp(&a.is_foreground)
            .then_with(|| a.app.to_lowercase().cmp(&b.app.to_lowercase()))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    Ok(windows)
}

/// Resolves a stored `(process, title)` selection back to a capturable window.
///
/// Prefers an exact title match within the process, then the process's largest
/// window (titles change constantly — browser tabs, documents). Fails when no
/// window of that process is open any more, so the caller can fall back.
pub fn resolve(process: Option<&str>, title: Option<&str>) -> Result<Window> {
    let windows: Vec<Window> = Window::enumerate()?
        .into_iter()
        .filter(is_capturable)
        .collect();

    let matches_process = |window: &Window| match process.filter(|name| !name.is_empty()) {
        Some(name) => window
            .process_name()
            .map(|open| open.eq_ignore_ascii_case(name))
            .unwrap_or(false),
        None => true,
    };

    if let Some(title) = title.filter(|title| !title.is_empty()) {
        if let Some(window) = windows.iter().find(|window| {
            matches_process(window)
                && window
                    .title()
                    .map(|open| open.eq_ignore_ascii_case(title))
                    .unwrap_or(false)
        }) {
            return Ok(*window);
        }
    }

    windows
        .iter()
        .filter(|window| matches_process(window))
        .max_by_key(|window| window.width().unwrap_or(0) as i64 * window.height().unwrap_or(0) as i64)
        .copied()
        .ok_or_else(|| anyhow!("the selected window is not available"))
}

fn describe(window: Window, foreground: Option<Window>, own_pid: u32) -> Option<WindowInfo> {
    if !is_capturable(&window) {
        return None;
    }

    let pid = window.process_id().ok()?;
    if pid == own_pid {
        return None;
    }

    let title = window.title().ok()?;
    let app = window
        .process_name()
        .unwrap_or_else(|_| "Unknown".to_string());

    Some(WindowInfo {
        id: format!("{pid}:{:x}", window.as_raw_hwnd() as usize),
        title,
        app,
        pid,
        width: window.width().unwrap_or(0).max(0) as u32,
        height: window.height().unwrap_or(0).max(0) as u32,
        is_foreground: foreground == Some(window),
        icon_png: icon::icon_for_pid(pid),
    })
}

/// The crate already filters to visible, non-tool, non-child windows; this adds
/// the "has a title" requirement that a picker needs.
fn is_capturable(window: &Window) -> bool {
    window.is_valid() && window.title().map(|title| !title.trim().is_empty()).unwrap_or(false)
}
