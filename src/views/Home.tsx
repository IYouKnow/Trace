import { listen } from "@tauri-apps/api/event";
import {
  AppWindow,
  Film,
  LoaderCircle,
  Play,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppIcon, AppPickerDialog } from "../components/AppPickerDialog";
import { ClipThumbnail } from "../components/ClipThumbnail";
import { MonitorCard } from "../components/MonitorCard";
import { WindowControls } from "../components/WindowControls";
import { Banner } from "../components/ui/Banner";
import {
  api,
  assetUrl,
  type CaptureSource,
  type CaptureTarget,
  type Clip,
  type MonitorInfo,
  type Status,
  type WindowInfo,
} from "../lib/api";
import { cx } from "../lib/cx";

/// Encoders that typically run on the CPU rather than a GPU block.
const SOFTWARE_ENCODERS = ["h264_mf", "libopenh264"];

const RECENT_LIMIT = 3;

type Props = {
  status: Status | null;
  pollError: string | null;
  onChanged: () => void;
};

export default function Home({ status, pollError, onChanged }: Props) {
  const [saveBusy, setSaveBusy] = useState(false);
  const [replayBusy, setReplayBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [targetBusy, setTargetBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedApp, setPickedApp] = useState<WindowInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const replaying = status?.replaying ?? false;
  const replayStartedMs = status?.replay_started_ms ?? null;
  const bufferSeconds = status?.buffer_seconds ?? 0;
  const source: CaptureSource = status?.capture_source ?? "screen";

  // What the backend is recording, so a change can patch just one part and keep
  // the rest (the display choice survives while an app is selected).
  const currentTarget: CaptureTarget = {
    source,
    monitor: status?.monitor ?? null,
    windowProcess: status?.window_app ?? null,
    windowTitle: status?.window_title ?? null,
  };

  // The recorded app: the freshly picked one, or whatever the backend reports.
  const appName = pickedApp?.app ?? status?.window_app ?? null;
  const appTitle = pickedApp?.title ?? status?.window_title ?? null;
  const appIcon = pickedApp?.icon_png ?? null;

  // Tick while recording so the elapsed timer advances between status polls.
  useEffect(() => {
    if (!replaying) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [replaying]);

  const recordedSeconds =
    replaying && replayStartedMs
      ? Math.max(0, Math.floor((now - replayStartedMs) / 1000))
      : 0;
  const softwareEncoder = status?.encoder
    ? SOFTWARE_ENCODERS.includes(status.encoder)
    : false;

  // The remembered selection, falling back to the primary display when none is
  // stored or the stored monitor is no longer attached.
  const selectedId =
    (monitors.some((m) => m.id === status?.monitor) ? status?.monitor : null) ??
    monitors.find((m) => m.is_primary)?.id ??
    monitors[0]?.id;

  const loadClips = useCallback(async () => {
    try {
      const all = await api.listClips();
      setClips([...all].sort((a, b) => b.modified_ms - a.modified_ms).slice(0, RECENT_LIMIT));
    } catch {
      setClips([]);
    }
  }, []);

  const loadMonitors = useCallback(async () => {
    try {
      setMonitors(await api.listMonitors());
    } catch {
      setMonitors([]);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors, replaying]);

  useEffect(() => {
    const onFocus = () => loadMonitors();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadMonitors]);

  useEffect(() => {
    loadClips();
  }, [loadClips]);

  // Any save path — the button, the global hotkey, or the tray — emits this,
  // so recents update without needing to leave and re-enter the view.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("clips-changed", () => {
      loadClips();
    })
      .then((stop) => {
        unlisten = stop;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, [loadClips]);

  async function runReplay() {
    setReplayBusy(true);
    setError(null);
    try {
      await (replaying ? api.stopReplay() : api.startReplay());
      onChanged();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setReplayBusy(false);
    }
  }

  async function save() {
    setSaveBusy(true);
    setError(null);
    try {
      await api.saveClip();
      onChanged();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaveBusy(false);
    }
  }

  /// Applies a capture-target change, restarting capture when one is running.
  async function applyTarget(patch: Partial<CaptureTarget>) {
    setTargetBusy(true);
    setError(null);
    try {
      await api.setCaptureTarget({ ...currentTarget, ...patch });
      onChanged();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setTargetBusy(false);
    }
  }

  /// Switches the recorded display. While replaying this restarts capture on
  /// the new monitor, so it can take a moment.
  async function selectMonitor(id: string) {
    if (source === "screen" && id === status?.monitor) return;
    await applyTarget({ source: "screen", monitor: id });
  }

  /// Flips between recording a whole screen and a single app. Picking "app"
  /// opens the picker first, so the source only changes once a window is chosen.
  function changeSource(next: CaptureSource) {
    if (next === "window") {
      setPickerOpen(true);
      return;
    }
    if (next === source) return;
    void applyTarget({ source: "screen" });
  }

  /// Records the window the user picked from the dialog.
  async function pickApp(window: WindowInfo) {
    setPickerOpen(false);
    setPickedApp(window);
    await applyTarget({
      source: "window",
      windowProcess: window.app,
      windowTitle: window.title,
    });
  }

  /// Moves a recent clip to the Recycle Bin; the backend then emits
  /// `clips-changed`, which reloads the list.
  async function remove(clip: Clip) {
    try {
      await api.deleteClip(clip.path);
    } catch (caught) {
      setError(String(caught));
    }
  }

  const shownError = error ?? pollError;

  return (
    <div className="relative flex flex-1 flex-col">
      <div data-tauri-drag-region="deep" className="absolute inset-x-0 top-0 h-9" />
      <div className="absolute right-1.5 top-1 z-10">
        <WindowControls />
      </div>
      <div
        className={cx(
          "mx-auto my-auto flex w-full flex-col gap-5 px-6 py-8",
          monitors.length > 1 ? "max-w-2xl" : "max-w-xl",
        )}
      >
        {shownError && <Banner tone="error">{shownError}</Banner>}

        {softwareEncoder && (
          <Banner tone="warn">
            <strong>{status?.encoder}</strong> may be a software encoder and can make the
            whole PC feel slow. Install your GPU driver so a hardware encoder can be used.
          </Banner>
        )}

        {status?.audio_warning && <Banner tone="warn">{status.audio_warning}</Banner>}

        {status?.capture_warning && (
          <Banner tone="warn">{status.capture_warning}</Banner>
        )}

        <div className="flex justify-center">
          <div
            role="group"
            aria-label="Capture source"
            className="inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line bg-surface p-0.5"
          >
            {(
              [
                ["screen", "Whole screen"],
                ["window", "App"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={targetBusy}
                aria-pressed={source === value}
                onClick={() => changeSource(value)}
                className={cx(
                  "h-7 cursor-pointer rounded-[6px] px-3 text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
                  source === value
                    ? "bg-accent text-accent-ink"
                    : "text-ink-muted hover:bg-elevated hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {source === "screen" &&
          monitors.length > 0 && (
            <div
              className={cx(
                "grid gap-3",
                monitors.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
              )}
            >
              {monitors.map((monitor) => (
                <MonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  selected={monitor.id === selectedId}
                  replaying={replaying}
                  bufferSeconds={bufferSeconds}
                  recordedSeconds={recordedSeconds}
                  busy={targetBusy}
                  onSelect={() => selectMonitor(monitor.id)}
                />
              ))}
            </div>
          )}

        {source === "window" && (
          <button
            type="button"
            disabled={targetBusy}
            onClick={() => setPickerOpen(true)}
            className={cx(
              "flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] border bg-surface px-4 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
              replaying && appTitle
                ? "capture-glow border-rec/40"
                : "border-line hover:border-line-strong",
            )}
          >
            {appIcon && appName ? (
              <AppIcon png={appIcon} app={appName} />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-elevated text-ink-faint">
                <AppWindow className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">
                {appTitle ?? "Choose an app"}
              </span>
              <span className="block truncate text-[12px] text-ink-faint">
                {appName ?? "Record one window instead of the whole screen"}
              </span>
            </span>
            <span className="shrink-0 rounded-[var(--radius-control)] border border-line px-2.5 py-1 text-[12px] text-ink-muted">
              Change
            </span>
          </button>
        )}

        <div className="flex flex-col items-center gap-2.5">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label={replaying ? "Stop replay" : "Start replay"}
              title={replaying ? "Stop replay" : "Start replay"}
              disabled={replayBusy}
              onClick={runReplay}
              className={cx(
                "grid size-14 cursor-pointer place-items-center rounded-full border transition duration-150 disabled:pointer-events-none disabled:opacity-60",
                replaying
                  ? "border-line bg-surface text-ink hover:bg-elevated"
                  : "border-transparent bg-elevated text-ink hover:bg-line",
              )}
            >
              {replayBusy ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : replaying ? (
                <Square className="size-4" />
              ) : (
                <Play className="size-5" />
              )}
            </button>

            <button
              type="button"
              disabled={saveBusy || !replaying}
              onClick={save}
              className="save-glow inline-flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-accent px-8 text-[15px] font-semibold text-accent-ink transition duration-150 hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45"
            >
              {saveBusy ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Save className="size-5" />
              )}
              Save clip
            </button>
          </div>

          <p className="text-center text-[13px] text-ink-muted">
            {replaying
              ? `Saves the last ${bufferSeconds}s to your clips folder`
              : "Start replay to keep a rolling buffer"}
          </p>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Recent clips
          </h2>
          {clips.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] border border-dashed border-line px-3.5 py-4 text-center text-[13px] text-ink-faint">
              No clips yet — saved clips show up here.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {clips.map((clip) => (
                <div
                  key={clip.path}
                  className="group relative aspect-video overflow-hidden rounded-[var(--radius-control)] border border-line bg-black transition-colors hover:border-line-strong"
                >
                  <button
                    type="button"
                    onClick={() => api.openClip(clip.path)}
                    title={clip.name}
                    aria-label={`Open ${clip.name}`}
                    className="absolute inset-0 cursor-pointer"
                  >
                    <span className="absolute inset-0 grid place-items-center text-ink-faint">
                      <Film className="size-5" />
                    </span>
                    <ClipThumbnail src={assetUrl(clip.path)} />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition duration-150 group-hover:bg-black/35 group-hover:opacity-100">
                      <Play className="size-6 text-white" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(clip)}
                    title="Delete clip"
                    aria-label={`Delete ${clip.name}`}
                    className="invisible absolute right-1.5 top-1.5 grid size-8 cursor-pointer place-items-center rounded-full border border-white/15 bg-black/60 text-white opacity-0 backdrop-blur transition duration-150 hover:bg-rec group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {pickerOpen && (
        <AppPickerDialog onClose={() => setPickerOpen(false)} onSelect={pickApp} />
      )}
    </div>
  );
}
