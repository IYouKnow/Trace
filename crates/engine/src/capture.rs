//! Desktop capture via the Windows Graphics Capture API (`windows-capture`).
//!
//! Frames leave the capture thread already on the GPU: the captured BGRA
//! texture is converted to NV12 by a D3D11 video processor and handed to the
//! encoder as a hardware frame, so nothing full-frame crosses the CPU. On
//! machines without a usable GPU path, the raw BGRA buffer is forwarded instead.

use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crossbeam_channel::Sender;
use ffmpeg_next::ffi;
use windows::Win32::Foundation::{HWND, POINT, RECT};
use windows::Win32::Graphics::Direct3D11::{
    D3D11_MAP_READ, D3D11_MAPPED_SUBRESOURCE, ID3D11Device, ID3D11DeviceContext,
};
use windows::Win32::Graphics::Gdi::ClientToScreen;
use windows::Win32::UI::WindowsAndMessaging::{GetClientRect, IsIconic};
use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
use windows_capture::d3d11::StagingTexture;
use windows_capture::encoder::ImageFormat;
use windows_capture::frame::{Frame, FrameBuffer};
use windows_capture::graphics_capture_api::InternalCaptureControl;
use windows_capture::monitor::Monitor;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    GraphicsCaptureItemType, MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;

use crate::encode;
use crate::hw::{self, GpuDevice, HwFrame, HwFrames, VideoProcessor};
use crate::session::SessionStats;

/// How long to wait for a frame with actual pixels before giving up.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

type BoxError = Box<dyn std::error::Error + Send + Sync>;

/// Which pipeline the capture thread will feed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapturePath {
    /// GPU texture → GPU convert → hardware encoder (no CPU copy).
    ZeroCopy,
    /// GPU convert → NV12 download → software encoder.
    GpuDownload,
    /// CPU readback + swscale → encoder.
    CpuFallback,
}

/// One-time pipeline description sent before the first frame.
pub struct CaptureSetup {
    pub path: CapturePath,
    pub hw_frames: Option<Arc<HwFrames>>,
    pub width: u32,
    pub height: u32,
}

/// A CPU NV12 `AVFrame` handed to the encoder (owner transfers on send).
pub struct Nv12Frame(pub *mut ffi::AVFrame);

// The frame is exclusively owned and only moved between threads.
unsafe impl Send for Nv12Frame {}

impl Nv12Frame {
    /// Relinquishes ownership so the encoder can take the frame.
    pub fn into_raw(mut self) -> *mut ffi::AVFrame {
        let frame = self.0;
        self.0 = std::ptr::null_mut();
        std::mem::forget(self);
        frame
    }
}

impl Drop for Nv12Frame {
    fn drop(&mut self) {
        if self.0.is_null() {
            return;
        }
        unsafe {
            let mut frame = self.0;
            ffi::av_frame_free(&mut frame);
        }
    }
}

/// The pixel data for one captured frame.
pub enum CapturedData {
    /// Zero-copy: an NV12 D3D11 frame borrowed from the hardware pool.
    Hw(HwFrame),
    /// Downloaded NV12 frame for a software encoder.
    Nv12(Nv12Frame),
    /// Raw BGRA pixels (fallback path), row padding preserved.
    ///
    /// Shared so a synthesized (black) frame can be handed over without copying a
    /// full frame buffer every time. `x`/`y` select the region to use within the
    /// buffer (non-zero when an app is recorded from the screen).
    Bgra {
        data: Arc<[u8]>,
        pitch: usize,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
}

/// A frame forwarded to the encoder thread.
pub struct CapturedFrame {
    pub data: CapturedData,
    pub width: u32,
    pub height: u32,
    pub timestamp_micros: i64,
}

/// Messages sent from the capture thread to the encoder worker.
pub enum CaptureMessage {
    Setup(CaptureSetup),
    Frame(CapturedFrame),
}

/// Capture-side settings needed to pick the pipeline.
#[derive(Clone, Copy)]
pub struct CaptureConfig {
    pub fps: u32,
    pub bitrate: u64,
}

/// A region of the captured display that follows a window's client area.
///
/// Used for apps whose pixels window capture cannot read while they are in the
/// background (Chromium/Electron such as Discord): the composited screen still
/// shows them, so the display is captured and cropped to the app instead.
#[derive(Debug, Clone, Copy)]
pub struct CropTarget {
    /// Raw handle of the window to follow (an integer so the capture stays `Send`).
    pub window: usize,
    /// Where the captured display starts on the desktop, in screen pixels.
    pub monitor_x: i32,
    pub monitor_y: i32,
}

/// What the handler needs to know beyond the captured item itself.
#[derive(Debug, Clone, Copy)]
struct Focus {
    /// The window being recorded, if any: drives the minimized check and cropping.
    window: Option<usize>,
    /// Region of the frame to use, when recording an app from the screen.
    crop: Option<CropTarget>,
}

/// Handle to a running capture session.
pub struct CaptureHandle {
    control: CaptureControl<FrameForwarder, BoxError>,
}

impl CaptureHandle {
    /// Stops the capture thread and waits for it to finish.
    pub fn stop(self) -> anyhow::Result<()> {
        self.control.stop().map_err(|error| anyhow::anyhow!("{error}"))
    }
}

/// Starts capturing `monitor`, forwarding frames to `sink`.
pub fn start_monitor_capture(
    monitor: Monitor,
    sink: Sender<CaptureMessage>,
    stop: Arc<AtomicBool>,
    config: CaptureConfig,
    stats: Arc<SessionStats>,
    origin: Instant,
) -> anyhow::Result<CaptureHandle> {
    start_capture(
        monitor,
        Focus {
            window: None,
            crop: None,
        },
        sink,
        stop,
        config,
        stats,
        origin,
    )
}

/// Starts capturing a single `window` directly, forwarding frames to `sink`.
pub fn start_window_capture(
    window: Window,
    sink: Sender<CaptureMessage>,
    stop: Arc<AtomicBool>,
    config: CaptureConfig,
    stats: Arc<SessionStats>,
    origin: Instant,
) -> anyhow::Result<CaptureHandle> {
    start_capture(
        window,
        Focus {
            window: Some(window.as_raw_hwnd() as usize),
            crop: None,
        },
        sink,
        stop,
        config,
        stats,
        origin,
    )
}

/// Starts capturing `monitor`, cropped to `crop`'s window client area.
///
/// This is the fallback for apps that do not draw into their own surface while
/// they are in the background: the display is captured and each frame is cropped
/// to wherever the app currently is, so the recording follows it around.
pub fn start_area_capture(
    monitor: Monitor,
    crop: CropTarget,
    sink: Sender<CaptureMessage>,
    stop: Arc<AtomicBool>,
    config: CaptureConfig,
    stats: Arc<SessionStats>,
    origin: Instant,
) -> anyhow::Result<CaptureHandle> {
    start_capture(
        monitor,
        Focus {
            window: Some(crop.window),
            crop: Some(crop),
        },
        sink,
        stop,
        config,
        stats,
        origin,
    )
}

/// Starts a capture on `item` (a monitor or a window).
///
/// Dirty-region reporting is requested so a static screen costs nothing; the
/// OS-side update interval is only a hint, so real pacing happens in the
/// handler. Both are optional and degrade gracefully on older Windows builds.
///
/// For a window, the focus also drives a watchdog: a minimized window stops
/// painting, so without help the replay buffer would keep the last visible frame
/// and a saved clip would show stale content. The watchdog feeds black frames so
/// the timeline keeps advancing and the clip shows the window as it is — blank.
fn start_capture<T>(
    item: T,
    focus: Focus,
    sink: Sender<CaptureMessage>,
    stop: Arc<AtomicBool>,
    config: CaptureConfig,
    stats: Arc<SessionStats>,
    origin: Instant,
) -> anyhow::Result<CaptureHandle>
where
    T: TryInto<GraphicsCaptureItemType> + Copy + Send + 'static,
{
    let interval = Duration::from_micros(1_000_000 / config.fps.max(1) as u64);

    // Prefer dirty regions + a tight interval; fall back to defaults when the
    // OS build lacks support (start would otherwise fail outright).
    let attempts = [
        (
            DirtyRegionSettings::ReportOnly,
            MinimumUpdateIntervalSettings::Custom(interval),
        ),
        (
            DirtyRegionSettings::Default,
            MinimumUpdateIntervalSettings::Default,
        ),
    ];

    let mut last_error = None;
    for (dirty, min_interval) in attempts {
        let settings = Settings::new(
            item,
            CursorCaptureSettings::WithCursor,
            DrawBorderSettings::WithoutBorder,
            SecondaryWindowSettings::Default,
            min_interval,
            dirty,
            ColorFormat::Bgra8,
            (
                sink.clone(),
                stop.clone(),
                config,
                stats.clone(),
                origin,
                focus,
            ),
        );

        match FrameForwarder::start_free_threaded(settings) {
            Ok(control) => {
                if focus.window.is_some() {
                    spawn_blank_frame_watchdog(&control, interval);
                }
                return Ok(CaptureHandle { control });
            }
            Err(error) => last_error = Some(anyhow::anyhow!("{error}")),
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("capture could not be started")))
}

/// Periodically asks the handler to feed a black frame while its window is
/// minimized. The handler is only callable through the capture control, which is
/// how a callback-driven capture gets a clock of its own.
fn spawn_blank_frame_watchdog(control: &CaptureControl<FrameForwarder, BoxError>, interval: Duration) {
    let callback = control.callback();
    let halt = control.halt_handle();

    let spawned = std::thread::Builder::new()
        .name("trace-window-idle".into())
        .spawn(move || {
            while !halt.load(Ordering::Relaxed) {
                std::thread::sleep(interval);
                if halt.load(Ordering::Relaxed) {
                    break;
                }
                let mut handler = callback.lock();
                if let Err(error) = handler.emit_black_if_minimized() {
                    report_frame_error(&error);
                }
            }
        });

    if let Err(error) = spawned {
        eprintln!("failed to start the minimized-window watchdog: {error}");
    }
}

/// Forwards each changed frame to the encoder thread.
struct FrameForwarder {
    sink: Sender<CaptureMessage>,
    stop: Arc<AtomicBool>,
    stats: Arc<SessionStats>,
    config: CaptureConfig,
    /// Shared session clock, so video frames align with audio capture.
    origin: Instant,
    interval: Duration,
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    /// Raw handle of the captured window (when the target is a window) and the
    /// region of the frame to use (when recording an app from the screen).
    focus: Focus,
    /// Cached black canvas-sized BGRA buffer, for the CPU fallback path.
    blank_bgra: Option<Arc<[u8]>>,
    /// Cached CPU readback texture for the fallback path (avoids allocating a
    /// staging texture every frame).
    readback: Option<StagingTexture>,
    /// Built on the first changed frame.
    pipeline: Option<Pipeline>,
    last_emit: Option<Instant>,
}

struct Pipeline {
    path: CapturePath,
    gpu: Option<GpuDevice>,
    hw_frames: Option<Arc<HwFrames>>,
    processor: Option<VideoProcessor>,
    /// Fixed capture canvas (`width`x`height`); every frame is scaled onto it.
    width: u32,
    height: u32,
    /// Size the video processor is currently built for (the source frame size).
    input_width: u32,
    input_height: u32,
    fps: u32,
}

impl GraphicsCaptureApiHandler for FrameForwarder {
    type Flags = (
        Sender<CaptureMessage>,
        Arc<AtomicBool>,
        CaptureConfig,
        Arc<SessionStats>,
        Instant,
        Focus,
    );
    type Error = BoxError;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        // Capture must never outrank the foreground; run below normal priority.
        hw::set_current_thread_below_normal();
        let (sink, stop, config, stats, origin, focus) = ctx.flags;
        Ok(Self {
            sink,
            stop,
            stats,
            config,
            origin,
            interval: Duration::from_micros(1_000_000 / config.fps.max(1) as u64),
            device: ctx.device,
            context: ctx.device_context,
            focus,
            blank_bgra: None,
            readback: None,
            pipeline: None,
            last_emit: None,
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame<'_>,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        if self.stop.load(Ordering::Relaxed) {
            capture_control.stop();
            return Ok(());
        }

        // Skip frames the compositor reports as unchanged.
        let changed = match frame.dirty_regions() {
            Ok(regions) => !regions.is_empty(),
            Err(_) => true,
        };
        if !changed {
            self.stats.record_idle();
            return Ok(());
        }

        // Cap the output rate even when the display refreshes faster.
        let now = Instant::now();
        if let Some(last) = self.last_emit {
            if now.duration_since(last) < self.interval {
                self.stats.record_dropped();
                return Ok(());
            }
        }
        self.last_emit = Some(now);

        let timestamp_micros = self.origin.elapsed().as_micros() as i64;

        // What to use from this frame: all of it, or the app's client area
        // (which moves with the window, so it is recomputed every frame).
        let Some(content) = self.content_rect(frame.width(), frame.height()) else {
            self.stats.record_idle();
            return Ok(());
        };

        if self.pipeline.is_none() {
            let content_width = (content.right - content.left) as u32;
            let content_height = (content.bottom - content.top) as u32;
            self.pipeline = Some(build_pipeline(
                &self.device,
                &self.context,
                self.config,
                content_width,
                content_height,
                frame,
            )?);
            let pipeline = self.pipeline.as_ref().unwrap();
            if self
                .sink
                .send(CaptureMessage::Setup(CaptureSetup {
                    path: pipeline.path,
                    hw_frames: pipeline.hw_frames.clone(),
                    width: pipeline.width,
                    height: pipeline.height,
                }))
                .is_err()
            {
                capture_control.stop();
                return Ok(());
            }
        }

        // Building the payload can fail for transient reasons — most of all the
        // hardware frame pool being momentarily exhausted while the encoder still
        // holds frames the capture side has not recycled. A dropped frame is the
        // right response: returning the error here would halt capture for good.
        let pipeline = self.pipeline.as_mut().unwrap();
        let canvas_width = pipeline.width;
        let canvas_height = pipeline.height;
        let data = match build_frame_data(
            pipeline,
            &self.device,
            &self.context,
            &mut self.readback,
            frame,
            timestamp_micros,
            content,
        ) {
            Ok(data) => data,
            Err(error) => {
                self.stats.record_dropped();
                report_frame_error(&error);
                return Ok(());
            }
        };

        // Never block the capture thread: if the encoder is behind, drop the
        // frame (it returns to the pool) and count it.
        match self.sink.try_send(CaptureMessage::Frame(CapturedFrame {
            data,
            width: canvas_width,
            height: canvas_height,
            timestamp_micros,
        })) {
            Ok(()) => {}
            Err(crossbeam_channel::TrySendError::Full(_)) => {
                self.stats.record_dropped();
            }
            Err(crossbeam_channel::TrySendError::Disconnected(_)) => {
                capture_control.stop();
            }
        }

        Ok(())
    }

    /// Fired when the capture item closes — for a window target, that is the app
    /// exiting, which the UI reports so the user knows why capture stopped.
    fn on_closed(&mut self) -> Result<(), Self::Error> {
        self.stats
            .set_capture_warning("the captured window was closed".to_string());
        Ok(())
    }
}

/// Chooses and builds the strongest pipeline this machine supports.
fn build_pipeline(
    device: &ID3D11Device,
    context: &ID3D11DeviceContext,
    config: CaptureConfig,
    content_width: u32,
    content_height: u32,
    frame: &Frame<'_>,
) -> Result<Pipeline, BoxError> {
    // The content of the first frame fixes the canvas every later frame is scaled
    // onto. NV12 and H.264 need even dimensions, and a resized window can be odd,
    // so round down.
    let width = even(content_width);
    let height = even(content_height);
    // The input texture itself is the whole captured frame (a display).
    let input_width = frame.width();
    let input_height = frame.height();

    // The GPU path is all-or-nothing and can be slow/flaky to probe; if it
    // failed once in this process, go straight to CPU so we neither stall nor
    // spam on every session.
    static GPU_DISABLED: AtomicBool = AtomicBool::new(false);
    if GPU_DISABLED.load(Ordering::Relaxed) {
        return Ok(cpu_pipeline(width, height, input_width, input_height, config.fps));
    }

    let gpu = GpuDevice::from_parts(device.clone(), context.clone());

    // Drivers disagree on the NV12 texture's bind flags (and some reject the
    // array form for a single slice), so try the likely combinations before
    // giving up on the GPU path.
    let mut candidates: Vec<(u32, u32)> = hw::BIND_CANDIDATES
        .iter()
        .map(|flags| (*flags, hw::FRAME_POOL_SIZE))
        .collect();
    candidates.push((hw::BIND_RENDER_TARGET, 1));

    let mut last_error: Option<anyhow::Error> = None;
    for (bind_flags, pool) in candidates {
        match build_gpu_pipeline(
            &gpu,
            width,
            height,
            input_width,
            input_height,
            config,
            bind_flags,
            pool,
        ) {
            Ok(pipeline) => return Ok(pipeline),
            Err(error) => last_error = Some(error),
        }
    }

    GPU_DISABLED.store(true, Ordering::Relaxed);
    if let Some(error) = last_error {
        log_gpu_fallback(&error);
    }
    Ok(cpu_pipeline(width, height, input_width, input_height, config.fps))
}

/// Rounds a dimension down to an even number (at least 2).
fn even(value: u32) -> u32 {
    value.max(2) & !1
}

/// Builds a GPU pipeline with the given texture bind flags and pool size, or
/// fails so the caller can try another combination.
#[allow(clippy::too_many_arguments)]
fn build_gpu_pipeline(
    gpu: &GpuDevice,
    width: u32,
    height: u32,
    input_width: u32,
    input_height: u32,
    config: CaptureConfig,
    bind_flags: u32,
    pool: u32,
) -> anyhow::Result<Pipeline> {
    // Create and validate the GPU conversion *before* building any FFmpeg
    // context, so a fallback never has to tear one down.
    let (texture, slices) = hw::create_nv12_texture(gpu, width, height, pool, bind_flags)?;
    let processor = VideoProcessor::new(
        gpu,
        &texture,
        slices,
        input_width,
        input_height,
        width,
        height,
        config.fps,
    )?;

    let hw_frames = HwFrames::from_texture(
        gpu,
        texture,
        width,
        height,
        slices,
        ffi::AVPixelFormat::AV_PIX_FMT_NV12,
        bind_flags,
    )?;

    // Ask the encoder directly: a vendor encoder can be compiled in yet
    // unusable on this driver.
    let path = if encode::probe_zero_copy(&hw_frames, width, height, config.fps, config.bitrate) {
        CapturePath::ZeroCopy
    } else {
        CapturePath::GpuDownload
    };
    Ok(Pipeline {
        path,
        gpu: Some(gpu.clone()),
        hw_frames: Some(Arc::new(hw_frames)),
        processor: Some(processor),
        width,
        height,
        input_width,
        input_height,
        fps: config.fps,
    })
}

/// Reports a GPU-path failure once per process.
fn log_gpu_fallback(error: &anyhow::Error) {
    use std::sync::Once;
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        eprintln!(
            "GPU zero-copy unavailable on this display/driver, using CPU capture \
             (frames are read back and converted on the CPU): {error:#}"
        );
    });
}

/// A pipeline for the pure-CPU fallback, which needs no GPU objects.
fn cpu_pipeline(width: u32, height: u32, input_width: u32, input_height: u32, fps: u32) -> Pipeline {
    Pipeline {
        path: CapturePath::CpuFallback,
        gpu: None,
        hw_frames: None,
        processor: None,
        width,
        height,
        input_width,
        input_height,
        fps,
    }
}

/// Reads a captured frame back to CPU memory through a reused staging texture.
///
/// The staging texture is recreated only when the frame geometry/format changes,
/// avoiding a GPU allocation on every frame.
fn readback_bgra(
    device: &ID3D11Device,
    context: &ID3D11DeviceContext,
    slot: &mut Option<StagingTexture>,
    frame: &Frame<'_>,
) -> Result<(Vec<u8>, usize), BoxError> {
    let width = frame.width();
    let height = frame.height();
    let format = frame.desc().Format;

    let recreate = match slot {
        Some(staging) => {
            let desc = staging.desc();
            desc.Width != width || desc.Height != height || desc.Format != format
        }
        None => true,
    };
    if recreate {
        *slot = Some(StagingTexture::new(device, width, height, format)?);
    }

    let staging = slot.as_ref().expect("staging texture just created");
    unsafe {
        context.CopyResource(staging.texture(), frame.as_raw_texture());
        let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
        context.Map(staging.texture(), 0, D3D11_MAP_READ, 0, Some(&mut mapped))?;
        let pitch = mapped.RowPitch as usize;
        let len = pitch * height as usize;
        let data = std::slice::from_raw_parts(mapped.pData as *const u8, len).to_vec();
        context.Unmap(staging.texture(), 0);
        Ok((data, pitch))
    }
}

/// Converts one captured frame into the pixel payload the encoder consumes,
/// following the pipeline chosen at startup.
///
/// `content` is the region of the frame to use: all of it for a display, or the
/// app's client area when an app is recorded from the screen.
///
/// When the source has been resized (a window was resized or maximised) the GPU
/// processor is rebuilt for the new input size while the NV12 canvas — and so the
/// encoder's frame pool — stays put.
fn build_frame_data(
    pipeline: &mut Pipeline,
    device: &ID3D11Device,
    context: &ID3D11DeviceContext,
    readback: &mut Option<StagingTexture>,
    frame: &Frame<'_>,
    timestamp_micros: i64,
    content: RECT,
) -> Result<CapturedData, BoxError> {
    if pipeline.path != CapturePath::CpuFallback {
        pipeline.sync_source_size(frame)?;
    }

    let content_width = (content.right - content.left) as u32;
    let content_height = (content.bottom - content.top) as u32;

    Ok(match pipeline.path {
        CapturePath::ZeroCopy => {
            let hw_frames = pipeline.hw_frames.as_ref().unwrap();
            let processor = pipeline.processor.as_ref().unwrap();
            let mut hw_frame = hw_frames.get_frame()?;
            unsafe {
                processor.convert(frame.as_raw_texture(), hw_frame.slice_index(), content)?;
            }
            // Submit the blit before the encoder picks the texture up.
            if let Some(gpu) = pipeline.gpu.as_ref() {
                let _ = unsafe { gpu.context.Flush() };
            }
            hw_frame.set_pts(timestamp_micros);
            CapturedData::Hw(hw_frame)
        }
        CapturePath::GpuDownload => {
            let hw_frames = pipeline.hw_frames.as_ref().unwrap();
            let processor = pipeline.processor.as_ref().unwrap();
            let hw_frame = hw_frames.get_frame()?;
            unsafe {
                processor.convert(frame.as_raw_texture(), hw_frame.slice_index(), content)?;
            }
            let cpu = hw_frame.download_nv12()?;
            unsafe {
                (*cpu).pts = timestamp_micros;
            }
            CapturedData::Nv12(Nv12Frame(cpu))
        }
        CapturePath::CpuFallback => {
            let (data, pitch) = readback_bgra(device, context, readback, frame)?;
            CapturedData::Bgra {
                data: Arc::from(data),
                pitch,
                x: content.left as u32,
                y: content.top as u32,
                width: content_width,
                height: content_height,
            }
        }
    })
}

impl FrameForwarder {
    /// The region of the captured frame to use.
    ///
    /// A display uses the whole frame. An app recorded from the screen uses its
    /// client area, converted from screen coordinates to frame coordinates — the
    /// app can be moved and resized, so this is recomputed for every frame.
    ///
    /// Returns `None` when none of the app overlaps the captured display (it was
    /// minimized, or moved to another monitor), so the frame is skipped.
    fn content_rect(&self, frame_width: u32, frame_height: u32) -> Option<RECT> {
        let whole = RECT {
            left: 0,
            top: 0,
            right: frame_width as i32,
            bottom: frame_height as i32,
        };
        let Some(crop) = self.focus.crop else {
            return Some(whole);
        };

        let window = HWND(crop.window as *mut c_void);
        let mut client = RECT::default();
        let mut corner = POINT::default();
        unsafe {
            if GetClientRect(window, &mut client).is_err() {
                return None;
            }
            if !ClientToScreen(window, &mut corner).as_bool() {
                return None;
            }
        }

        let left = corner.x - crop.monitor_x;
        let top = corner.y - crop.monitor_y;
        let rect = RECT {
            left: left.max(whole.left),
            top: top.max(whole.top),
            right: (left + (client.right - client.left)).min(whole.right),
            bottom: (top + (client.bottom - client.top)).min(whole.bottom),
        };

        // A couple of pixels is not a picture; treat it as nothing to record.
        if rect.right - rect.left < 2 || rect.bottom - rect.top < 2 {
            return None;
        }
        Some(rect)
    }

    /// Feeds a black frame while the captured window is minimized.
    ///
    /// A minimized window paints nothing, so no frames arrive and the replay
    /// buffer keeps the last visible frame — a saved clip would then show stale
    /// content instead of the window's real (blank) state. Feeding black frames
    /// keeps the timeline advancing so the clip shows black for that period.
    ///
    /// Called from the watchdog thread, which shares this handler with the
    /// capture thread, so the two never run at once.
    fn emit_black_if_minimized(&mut self) -> Result<(), BoxError> {
        let Some(handle) = self.focus.window else {
            return Ok(());
        };
        if self.stop.load(Ordering::Relaxed) {
            return Ok(());
        }
        if !unsafe { IsIconic(HWND(handle as *mut c_void)) }.as_bool() {
            return Ok(());
        }

        // Keep to the target frame rate, so the clip stays evenly paced.
        let now = Instant::now();
        if let Some(last) = self.last_emit {
            if now.duration_since(last) < self.interval {
                return Ok(());
            }
        }
        self.last_emit = Some(now);

        let timestamp_micros = self.origin.elapsed().as_micros() as i64;

        // Before the first frame there is no canvas to fill.
        let Some(pipeline) = self.pipeline.as_mut() else {
            return Ok(());
        };
        let (canvas_width, canvas_height) = (pipeline.width, pipeline.height);

        let data = match pipeline.path {
            CapturePath::ZeroCopy => {
                let hw_frames = pipeline.hw_frames.as_ref().unwrap();
                let processor = pipeline.processor.as_ref().unwrap();
                let mut hw_frame = hw_frames.get_frame()?;
                unsafe {
                    processor.convert_black(hw_frame.slice_index())?;
                }
                if let Some(gpu) = pipeline.gpu.as_ref() {
                    let _ = unsafe { gpu.context.Flush() };
                }
                hw_frame.set_pts(timestamp_micros);
                CapturedData::Hw(hw_frame)
            }
            CapturePath::GpuDownload => {
                let hw_frames = pipeline.hw_frames.as_ref().unwrap();
                let processor = pipeline.processor.as_ref().unwrap();
                let hw_frame = hw_frames.get_frame()?;
                unsafe {
                    processor.convert_black(hw_frame.slice_index())?;
                }
                let cpu = hw_frame.download_nv12()?;
                unsafe {
                    (*cpu).pts = timestamp_micros;
                }
                CapturedData::Nv12(Nv12Frame(cpu))
            }
            CapturePath::CpuFallback => {
                let pitch = canvas_width as usize * 4;
                let blank = self
                    .blank_bgra
                    .get_or_insert_with(|| vec![0u8; pitch * canvas_height as usize].into());
                CapturedData::Bgra {
                    data: blank.clone(),
                    pitch,
                    x: 0,
                    y: 0,
                    width: canvas_width,
                    height: canvas_height,
                }
            }
        };

        match self.sink.try_send(CaptureMessage::Frame(CapturedFrame {
            data,
            width: canvas_width,
            height: canvas_height,
            timestamp_micros,
        })) {
            Ok(()) => {}
            Err(crossbeam_channel::TrySendError::Full(_)) => self.stats.record_dropped(),
            Err(crossbeam_channel::TrySendError::Disconnected(_)) => {}
        }

        Ok(())
    }
}

impl Pipeline {
    /// Rebuilds the video processor when the source size changes.
    ///
    /// The NV12 output texture (and the `HwFrames` pool built on it) is fixed for
    /// the session, so only the conversion stage is recreated — the encoder never
    /// sees a size change.
    fn sync_source_size(&mut self, frame: &Frame<'_>) -> Result<(), BoxError> {
        let width = frame.width();
        let height = frame.height();
        if width == self.input_width && height == self.input_height {
            return Ok(());
        }

        if let (Some(gpu), Some(hw_frames)) = (self.gpu.as_ref(), self.hw_frames.as_ref()) {
            self.processor = Some(VideoProcessor::new(
                gpu,
                hw_frames.texture(),
                hw_frames.pool(),
                width,
                height,
                self.width,
                self.height,
                self.fps,
            )?);
        }

        self.input_width = width;
        self.input_height = height;
        Ok(())
    }
}

/// Reports the first frame-drop reason once, so a transient failure (such as the
/// hardware frame pool running dry) does not flood the console every frame it
/// lasts. Drops are still counted in the session stats.
fn report_frame_error(error: &BoxError) {
    use std::sync::Once;
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        eprintln!("dropped a captured frame: {error:#}");
    });
}

/// Grabs the first non-empty frame of the primary monitor and writes it as a PNG.
///
/// Blocking: returns once a frame with content has been saved, or fails if the
/// desktop looks blank/locked within `DEFAULT_TIMEOUT`.
pub fn save_primary_monitor_png(path: impl AsRef<Path>) -> anyhow::Result<()> {
    let monitor = Monitor::primary()?;
    let saved = Arc::new(AtomicBool::new(false));

    let settings = Settings::new(
        monitor,
        CursorCaptureSettings::WithCursor,
        DrawBorderSettings::WithoutBorder,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        (path.as_ref().to_path_buf(), saved.clone()),
    );

    let control = OneShotPng::start_free_threaded(settings)?;

    let deadline = Instant::now() + DEFAULT_TIMEOUT;
    let finished = loop {
        if control.is_finished() {
            break true;
        }
        if Instant::now() >= deadline {
            break false;
        }
        std::thread::sleep(Duration::from_millis(20));
    };

    if finished {
        control.wait()?;
    } else {
        control.stop()?;
    }

    if !saved.load(Ordering::Relaxed) {
        anyhow::bail!(
            "no non-empty frame within {DEFAULT_TIMEOUT:?}: \
             the desktop appears blank or the session is locked"
        );
    }
    Ok(())
}

/// Capture handler that saves the first frame containing actual pixels.
///
/// Diagnostic only.
struct OneShotPng {
    path: PathBuf,
    saved: Arc<AtomicBool>,
    seen: u32,
}

impl GraphicsCaptureApiHandler for OneShotPng {
    type Flags = (PathBuf, Arc<AtomicBool>);
    type Error = BoxError;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        let (path, saved) = ctx.flags;
        Ok(Self { path, saved, seen: 0 })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame<'_>,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        let mut buffer = frame.buffer()?;
        self.seen += 1;

        if self.seen == 1 {
            eprintln!(
                "first frame: {}x{} row_pitch={} format={:?}",
                buffer.width(),
                buffer.height(),
                buffer.row_pitch(),
                buffer.color_format(),
            );
        }

        if has_content(&mut buffer) {
            buffer.save_as_image(&self.path, ImageFormat::Png)?;
            self.saved.store(true, Ordering::Relaxed);
            capture_control.stop();
        }

        Ok(())
    }
}

/// Returns true if any sampled pixel has a non-zero colour channel.
///
/// Padding bytes between rows can be non-zero on a blank frame, so rows are
/// walked using `row_pitch` and only `width * 4` bytes of each are examined.
fn has_content(buffer: &mut FrameBuffer<'_>) -> bool {
    let width = buffer.width() as usize;
    let height = buffer.height() as usize;
    let row_pitch = buffer.row_pitch() as usize;
    let row_bytes = width * 4;
    let raw = buffer.as_raw_buffer();

    let step = 16;
    let mut y = 0;
    while y < height {
        let row = y * row_pitch;
        if row + row_bytes <= raw.len() {
            let mut x = 0;
            while x < width {
                let i = row + x * 4;
                if raw[i] | raw[i + 1] | raw[i + 2] != 0 {
                    return true;
                }
                x += step;
            }
        }
        y += step;
    }
    false
}
