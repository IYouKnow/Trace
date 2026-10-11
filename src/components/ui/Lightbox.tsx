import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { assetUrl, formatBytes, formatDate, type Clip } from "../../lib/api";

type Props = {
  clip: Clip;
  onClose: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), video, input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/// Seconds moved per arrow-key press.
const SEEK_STEP = 5;

/// Fullscreen player with keyboard transport: space toggles, arrows seek, esc
/// closes. Native controls stay for the mouse.
export function Lightbox({ clip, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const root = document.getElementById("root");
    const previouslyFocused = document.activeElement as HTMLElement | null;
    root?.setAttribute("inert", "");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === "Tab") {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      // Hand off to the native controls while they hold focus.
      const video = videoRef.current;
      if (!video || document.activeElement === video) return;

      if (event.key === " ") {
        event.preventDefault();
        if (video.paused) void video.play();
        else video.pause();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.key === "ArrowLeft" ? -SEEK_STEP : SEEK_STEP;
        const end = Number.isFinite(video.duration) ? video.duration : Infinity;
        video.currentTime = Math.min(Math.max(0, video.currentTime + step), end);
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      root?.removeAttribute("inert");
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={clip.name}
      tabIndex={-1}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 outline-none"
    >
      <header
        onMouseDown={(event) => event.stopPropagation()}
        className="flex items-center justify-between gap-4 px-5 py-3.5"
      >
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white" title={clip.name}>
            {clip.name}
          </p>
          <p className="mt-0.5 text-[12px] text-white/60">
            {formatBytes(clip.size_bytes)} · {formatDate(clip.modified_ms)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 place-items-center p-5">
        <video
          ref={videoRef}
          src={assetUrl(clip.path)}
          controls
          autoPlay
          onMouseDown={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-[var(--radius-control)] bg-black"
        />
      </div>

      <footer
        onMouseDown={(event) => event.stopPropagation()}
        className="px-5 pb-4 text-center text-[12px] text-white/45"
      >
        Space to play or pause · ← → to seek · Esc to close
      </footer>
    </div>,
    document.body,
  );
}
