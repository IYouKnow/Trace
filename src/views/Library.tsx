import { listen } from "@tauri-apps/api/event";
import { ExternalLink, Film, FolderOpen, Play, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ClipThumbnail } from "../components/ClipThumbnail";
import { WindowControls } from "../components/WindowControls";
import { Banner } from "../components/ui/Banner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Lightbox } from "../components/ui/Lightbox";
import { Panel } from "../components/ui/Panel";
import { api, assetUrl, formatBytes, type Clip } from "../lib/api";
import { toast } from "../lib/toast";

/// Icon buttons that fade in over a thumbnail on hover or keyboard focus.
const OVERLAY_BUTTON =
  "grid size-8 cursor-pointer place-items-center rounded-[var(--radius-control)] bg-black/55 text-white backdrop-blur transition-colors duration-150 hover:bg-black/80";

/// Shared reveal for everything that follows the tile's hover/focus state.
const REVEAL = "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100";

export default function Library() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [playing, setPlaying] = useState<Clip | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Clip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setClips(await api.listClips());
      setError(null);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the list current when a clip is saved or deleted elsewhere (hotkey,
  // tray, or another view).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("clips-changed", () => {
      refresh();
    })
      .then((stop) => {
        unlisten = stop;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, [refresh]);

  // Repair clips saved by older builds that declared the whole recording
  // session as the clip's duration. Runs in the background and is a no-op once
  // every clip is already correct.
  useEffect(() => {
    let active = true;
    api
      .repairClips()
      .then((count) => {
        if (active && count > 0) {
          toast(
            `Repaired ${count} older clip${count === 1 ? "" : "s"} that had the wrong duration.`,
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const closeLightbox = useCallback(() => setPlaying(null), []);

  async function remove(clip: Clip) {
    setPendingDelete(null);
    try {
      await api.deleteClip(clip.path);
      await refresh();
    } catch (caught) {
      setError(String(caught));
    }
  }

  return (
    <>
      <header
        data-tauri-drag-region="deep"
        className="sticky top-0 z-20 flex h-9 shrink-0 items-center justify-end bg-canvas px-1.5"
      >
        <WindowControls />
      </header>

      <div className="flex flex-col gap-4 px-6 pb-6 pt-3">
        {error && <Banner tone="error">{error}</Banner>}

        {clips.length === 0 ? (
          <Panel>
            {loading ? (
              <p className="text-[13px] text-ink-muted">Loading clips…</p>
            ) : (
              <EmptyState
                icon={Film}
                title="No clips yet"
                description="Start replay on Home, then press Save clip. Saved clips show up here."
              />
            )}
          </Panel>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
            {clips.map((clip) => (
              <li
                key={clip.path}
                className="group relative aspect-video overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface"
              >
                <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]">
                  <ClipThumbnail src={assetUrl(clip.path)} />
                </div>

                {/* Full-tile play target, under the overlay controls. */}
                <button
                  type="button"
                  aria-label={`Play ${clip.name}`}
                  onClick={() => setPlaying(clip)}
                  className="absolute inset-0 z-10 cursor-pointer"
                />

                <div className={`${REVEAL} pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-transparent to-transparent`} />

                <div className={`${REVEAL} pointer-events-none absolute inset-0 z-10 grid place-items-center`}>
                  <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                    <Play className="size-5 fill-current" />
                  </span>
                </div>

                <div className={`${REVEAL} pointer-events-none absolute right-2 top-2 z-20 flex gap-1 group-hover:pointer-events-auto group-focus-within:pointer-events-auto`}>
                  <button
                    type="button"
                    aria-label={`Open ${clip.name} in player`}
                    onClick={() => api.openClip(clip.path)}
                    className={OVERLAY_BUTTON}
                  >
                    <ExternalLink className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Reveal ${clip.name} in folder`}
                    onClick={() => api.revealClip(clip.path)}
                    className={OVERLAY_BUTTON}
                  >
                    <FolderOpen className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${clip.name}`}
                    onClick={() => setPendingDelete(clip)}
                    className={`${OVERLAY_BUTTON} hover:bg-rec`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className={`${REVEAL} pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 p-2.5`}>
                  <span className="truncate text-[12px] font-medium text-white">
                    {clip.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-white/70">
                    {formatBytes(clip.size_bytes)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {playing && <Lightbox clip={playing} onClose={closeLightbox} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete clip"
          message={`Move ${pendingDelete.name} to the Recycle Bin? You can restore it from there if you change your mind.`}
          confirmLabel="Delete clip"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove(pendingDelete)}
        />
      )}
    </>
  );
}
