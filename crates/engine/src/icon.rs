//! Extracts an application's shell icon as a small PNG.
//!
//! The picker shows real app icons, so a process id has to become a bitmap:
//! the executable path is looked up, the shell hands back an `HICON`, and that is
//! read back through GDI into RGBA and encoded as PNG. Results are cached per
//! executable, since many windows share one process image.

use std::collections::HashMap;
use std::ffi::c_void;
use std::sync::{Mutex, OnceLock};

use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
    HGDIOBJ,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};
use windows::core::{PCWSTR, PWSTR};

/// PNG bytes for the executable that owns `pid`, or `None` if unavailable.
pub fn icon_for_pid(pid: u32) -> Option<Vec<u8>> {
    let path = process_image_path(pid)?;
    icon_for_exe(&path)
}

/// Reads the full image path of `pid`, or `None` when it cannot be opened
/// (elevated or protected processes refuse even query access).
fn process_image_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = [0u16; 260];
        let mut size = buffer.len() as u32;
        let result =
            QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size);
        let _ = CloseHandle(handle);
        result.ok()?;
        Some(String::from_utf16_lossy(&buffer[..size as usize]))
    }
}

/// Per-executable icon cache; `None` remembers a failure so it is not retried.
fn cache() -> &'static Mutex<HashMap<String, Option<Vec<u8>>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<Vec<u8>>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn icon_for_exe(path: &str) -> Option<Vec<u8>> {
    let cache = cache();
    if let Ok(guard) = cache.lock() {
        if let Some(cached) = guard.get(path) {
            return cached.clone();
        }
    }

    let png = extract_icon_png(path);

    if let Ok(mut guard) = cache.lock() {
        guard.insert(path.to_string(), png.clone());
    }
    png
}

fn extract_icon_png(path: &str) -> Option<Vec<u8>> {
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let mut info = SHFILEINFOW::default();
        let ok = SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            Default::default(),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if ok == 0 || info.hIcon.0.is_null() {
            return None;
        }
        let png = hicon_to_png(info.hIcon);
        let _ = DestroyIcon(info.hIcon);
        png
    }
}

/// Converts an `HICON` to PNG bytes by reading its colour bitmap as 32bpp BGRA.
unsafe fn hicon_to_png(icon: HICON) -> Option<Vec<u8>> {
    let mut info = ICONINFO::default();
    GetIconInfo(icon, &mut info).ok()?;

    let color = info.hbmColor;
    let mask = info.hbmMask;

    let png = if color.0.is_null() {
        None
    } else {
        bitmap_to_png(color)
    };

    // GetIconInfo hands ownership of both bitmaps to the caller.
    if !color.0.is_null() {
        let _ = DeleteObject(HGDIOBJ(color.0));
    }
    if !mask.0.is_null() {
        let _ = DeleteObject(HGDIOBJ(mask.0));
    }
    png
}

unsafe fn bitmap_to_png(bitmap: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<Vec<u8>> {
    let mut header = BITMAP::default();
    let written = GetObjectW(
        HGDIOBJ(bitmap.0),
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut header as *mut _ as *mut c_void),
    );
    if written == 0 || header.bmWidth <= 0 || header.bmHeight <= 0 {
        return None;
    }

    let width = header.bmWidth as u32;
    let height = header.bmHeight as u32;

    let mut info = BITMAPINFO::default();
    info.bmiHeader.biSize = std::mem::size_of_val(&info.bmiHeader) as u32;
    info.bmiHeader.biWidth = width as i32;
    // Negative height asks for a top-down bitmap, matching PNG row order.
    info.bmiHeader.biHeight = -(height as i32);
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;

    let mut pixels = vec![0u8; width as usize * height as usize * 4];
    let dc = CreateCompatibleDC(None);
    let lines = GetDIBits(
        dc,
        bitmap,
        0,
        height,
        Some(pixels.as_mut_ptr() as *mut c_void),
        &mut info,
        windows::Win32::Graphics::Gdi::DIB_RGB_COLORS,
    );
    let _ = DeleteDC(dc);
    if lines == 0 {
        return None;
    }

    // Icons without an alpha channel come back fully transparent; treat an
    // all-zero alpha plane as opaque so the icon is visible.
    let transparent = pixels.chunks_exact(4).all(|pixel| pixel[3] == 0);
    if transparent {
        for pixel in pixels.chunks_exact_mut(4) {
            pixel[3] = 255;
        }
    }

    // GDI hands back BGRA; PNG wants RGBA.
    for pixel in pixels.chunks_exact_mut(4) {
        pixel.swap(0, 2);
    }

    encode_png(&pixels, width, height)
}

fn encode_png(rgba: &[u8], width: u32, height: u32) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(rgba).ok()?;
    }
    Some(out)
}
