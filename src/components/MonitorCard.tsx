import { Check, Monitor } from "lucide-react";
import type { MonitorInfo } from "../lib/api";
import { cx } from "../lib/cx";

type Props = {
  monitor: MonitorInfo;
  selected: boolean;
  replaying: boolean;
  bufferSeconds: number;
  recordedSeconds: number;
  busy?: boolean;
  onSelect: () => void;
};

/// `MM:SS`, or `H:MM:SS` once the recording passes an hour.
function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`;
}

/// One selectable monitor. The selected card is the display being recorded.
export function MonitorCard({
  monitor,
  selected,
  replaying,
  bufferSeconds,
  recordedSeconds,
  busy,
  onSelect,
}: Props) {
  const recording = selected && replaying;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Record ${monitor.name}`}
      className={cx(
        "relative block w-full overflow-hidden rounded-[18px] border bg-black text-left transition duration-150",
        busy && "pointer-events-none opacity-70",
        recording
          ? "capture-glow border-rec/40"
          : selected
            ? "border-accent"
            : "cursor-pointer border-line hover:border-line-strong",
      )}
    >
      <div className="relative aspect-video w-full">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {recording && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 h-20 animate-[scan_4s_linear_infinite] bg-gradient-to-b from-transparent via-rec/20 to-transparent"
          />
        )}

        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-white/45">
            <Monitor className="size-7" />
            <p className="text-[13px]">
              {recording ? "Recording this display" : "Live preview coming soon"}
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          {selected ? (
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white/85 backdrop-blur">
              <span
                aria-hidden="true"
                className={cx(
                  "size-2 rounded-full",
                  replaying
                    ? "animate-[rec-pulse_1.6s_ease-in-out_infinite] bg-rec"
                    : "bg-white/35",
                )}
              />
              {replaying ? "Buffering" : "Replay off"}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {monitor.is_primary && (
              <span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
                Primary
              </span>
            )}
            {selected && (
              <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-ink">
                <Check className="size-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">{monitor.name}</p>
          <p className="text-[11px] text-ink-faint">
            Display {monitor.index} · {monitor.width}×{monitor.height}
          </p>
        </div>
        {recording && (
          <span className="shrink-0 rounded-full border border-line bg-elevated px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums text-ink-muted">
            {formatDuration(recordedSeconds)} · last {bufferSeconds}s
          </span>
        )}
      </div>
    </button>
  );
}
