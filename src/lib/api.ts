import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";

export type Status = {
  replaying: boolean;
  replay_started_ms: number | null;
  encoder: string | null;
  pipeline: string | null;
  frames: number;
  packets: number;
  dropped: number;
  idle: number;
  audio: string | null;
  audio_warning: string | null;
  buffer_seconds: number;
  fps: number;
  bitrate: number;
  monitor: string | null;
  capture_source: CaptureSource;
  window_title: string | null;
  window_app: string | null;
  capture_warning: string | null;
  clips_dir: string;
  available_encoders: string[];
};

export type Clip = {
  path: string;
  name: string;
  size_bytes: number;
  modified_ms: number;
};

export type AudioSource = "off" | "system" | "microphone" | "both";

export type DeviceInfo = {
  id: string;
  track: string;
  name: string;
  sample_rate: number;
  channels: number;
  bits_per_sample: number;
  is_float: boolean;
};

export type AudioDevices = {
  system: DeviceInfo[];
  microphone: DeviceInfo[];
};

export type MicTestStatus = {
  active: boolean;
  level: number;
  peak: number;
  device: string | null;
};

export type MonitorInfo = {
  id: string;
  name: string;
  width: number;
  height: number;
  index: number;
  is_primary: boolean;
};

/** Whether Trace records a whole display or a single window. */
export type CaptureSource = "screen" | "window";

/** A window the user can choose to record. */
export type WindowInfo = {
  id: string;
  title: string;
  /** Owning process image name, e.g. `chrome.exe`. */
  app: string;
  pid: number;
  width: number;
  height: number;
  is_foreground: boolean;
  /** PNG bytes for the app icon, or null when it could not be extracted. */
  icon_png: number[] | null;
};

/** What to record; sent to the backend as a single target selection. */
export type CaptureTarget = {
  source: CaptureSource;
  monitor: string | null;
  windowProcess: string | null;
  windowTitle: string | null;
};

export type Settings = {
  auto_start: boolean;
  launch_at_login: boolean;
  buffer_seconds: number;
  fps: number;
  bitrate: number;
  encoder: string | null;
  audio_source: AudioSource;
  system_device: string | null;
  microphone_device: string | null;
  monitor: string | null;
  capture_source: CaptureSource;
  window_process: string | null;
  window_title: string | null;
};

export type Hotkeys = {
  toggle_replay: string | null;
  save_clip: string | null;
};

export const api = {
  getStatus: () => invoke<Status>("get_status"),
  startReplay: () => invoke<Status>("start_replay"),
  stopReplay: () => invoke<Status>("stop_replay"),
  saveClip: () => invoke<Clip>("save_clip"),

  listClips: () => invoke<Clip[]>("list_clips"),
  deleteClip: (path: string) => invoke<void>("delete_clip", { path }),
  openClip: (path: string) => invoke<void>("open_clip", { path }),
  revealClip: (path: string) => invoke<void>("reveal_clip", { path }),
  repairClips: () => invoke<number>("repair_clips"),

  getSettings: () => invoke<Settings>("get_settings"),
  setSettings: (settings: Settings) => invoke<void>("set_settings", { settings }),
  listAudioDevices: () => invoke<AudioDevices>("list_audio_devices"),
  listMonitors: () => invoke<MonitorInfo[]>("list_monitors"),
  listWindows: () => invoke<WindowInfo[]>("list_windows"),
  setCaptureTarget: (target: CaptureTarget) =>
    invoke<Status>("set_capture_target", target),
  startMicTest: (deviceId: string | null) =>
    invoke<MicTestStatus>("start_mic_test", { deviceId }),
  stopMicTest: () => invoke<void>("stop_mic_test"),
  micTestStatus: () => invoke<MicTestStatus>("mic_test_status"),

  getHotkeys: () => invoke<Hotkeys>("get_hotkeys"),
  setHotkeys: (hotkeys: Hotkeys) => invoke<void>("set_hotkeys", { hotkeys }),
  setHotkeysSuspended: (suspended: boolean) =>
    invoke<void>("set_hotkeys_suspended", { suspended }),

  getVersion: () => getVersion(),

  showUpdatePage: () => invoke<void>("show_update_page"),
};

/// Turns an absolute path into a URL the webview can load.
export const assetUrl = (path: string) => convertFileSrc(path);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}
