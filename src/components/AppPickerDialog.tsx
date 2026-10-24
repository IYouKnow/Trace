import { AppWindow, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type WindowInfo } from "../lib/api";
import { Modal } from "./ui/Modal";

type Props = {
  onClose: () => void;
  onSelect: (window: WindowInfo) => void;
};

type Group = {
  app: string;
  icon: number[] | null;
  windows: WindowInfo[];
};

/// Groups windows by their owning app, keeping the backend's foreground-first order.
function groupByApp(windows: WindowInfo[]): Group[] {
  const groups = new Map<string, Group>();
  for (const window of windows) {
    const existing = groups.get(window.app);
    if (existing) {
      existing.windows.push(window);
    } else {
      groups.set(window.app, {
        app: window.app,
        icon: window.icon_png,
        windows: [window],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.app.localeCompare(b.app));
}

/// An app's icon, falling back to a monogram tile when extraction failed.
export function AppIcon({ png, app }: { png: number[] | null; app: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!png || png.length === 0) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(
      new Blob([new Uint8Array(png)], { type: "image/png" }),
    );
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [png]);

  if (url) {
    return <img src={url} alt="" className="size-5 shrink-0" />;
  }

  const initial = app.replace(/\.exe$/i, "").slice(0, 1).toUpperCase() || "?";
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-[4px] bg-elevated text-[11px] font-semibold text-ink-muted">
      {initial}
    </span>
  );
}

/// Lets the user pick one open window to record, grouped by app.
export function AppPickerDialog({ onClose, onSelect }: Props) {
  const [windows, setWindows] = useState<WindowInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .listWindows()
      .then(setWindows)
      .catch((caught) => setError(String(caught)));
  }, []);

  const groups = useMemo(() => {
    const all = windows ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter(
          (window) =>
            window.title.toLowerCase().includes(needle) ||
            window.app.toLowerCase().includes(needle),
        )
      : all;
    return groupByApp(filtered);
  }, [windows, query]);

  return (
    <Modal
      title="Choose an app to record"
      onClose={onClose}
      width="max-w-lg"
      closeOnBackdrop={false}
    >
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-ink">
            Choose an app to record
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-elevated px-2.5">
          <Search className="size-3.5 shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search apps and windows"
            aria-label="Search apps and windows"
            autoFocus
            className="h-8 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        <div className="-mx-1 max-h-[52vh] overflow-y-auto px-1">
          {error && <p className="px-1 py-3 text-[13px] text-rec">{error}</p>}

          {!error && windows === null && (
            <p className="px-1 py-3 text-[13px] text-ink-muted">Looking for apps…</p>
          )}

          {!error && windows !== null && groups.length === 0 && (
            <p className="px-1 py-3 text-[13px] text-ink-faint">No apps match.</p>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <section key={group.app} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-1.5 pt-1">
                  <AppIcon png={group.icon} app={group.app} />
                  <span className="truncate text-[12px] font-medium text-ink-muted">
                    {group.app}
                  </span>
                </div>

                {group.windows.map((window) => (
                  <button
                    key={window.id}
                    type="button"
                    onClick={() => onSelect(window)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] border border-transparent px-2 py-1.5 text-left transition-colors duration-150 hover:border-line hover:bg-elevated"
                  >
                    <AppWindow className="size-4 shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">
                        {window.title}
                      </span>
                      <span className="block text-[11px] text-ink-faint">
                        {window.width}×{window.height}
                        {window.is_foreground ? " · In focus" : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
