import { Gauge, LayoutGrid, ListTree, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type Highlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type Release = {
  version: string;
  title: string;
  highlights: Highlight[];
};

/// Newest first. Add an entry for every release with user-facing changes; the
/// app will announce it once, then keep it on the Updates settings page.
export const RELEASES: Release[] = [
  {
    version: "0.5.0",
    title: "Settings, rebuilt",
    highlights: [
      {
        icon: LayoutGrid,
        title: "Settings split into pages",
        description:
          "Capture, General, Hotkeys, Appearance, Storage and Updates each get their own page, so every section has room to grow instead of sharing one long scroll.",
      },
      {
        icon: ListTree,
        title: "Jump straight to a section",
        description:
          "The Settings item in the sidebar now expands into its sections. Open Capture, Appearance or Storage in one click instead of scrolling to find it.",
      },
      {
        icon: Gauge,
        title: "Frame rate you control",
        description:
          "New recordings can run anywhere from 30 to 240 fps for smoother fast motion, or lower to save disk space. Bitrate follows your frame rate automatically and the slider shows the real figure for the setting you picked.",
      },
    ],
  },
];

const SEEN_KEY = "trace.whatsnew.seen";

// Keys the app wrote before this feature existed. Their presence means the
// install has run an older build, so a missing seen-version is an upgrade
// rather than a first install.
const PRIOR_KEYS = ["trace.theme", "trace.sidebar.collapsed"];

/// Notes for the running version, or null when it isn't a tracked release.
export function releaseFor(version: string | null): Release | null {
  if (!version) return null;
  const normalized = version.replace(/^v/, "");
  return RELEASES.find((release) => release.version === normalized) ?? null;
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {
    // Persisting is best-effort.
  }
}

function hasRunBefore(): boolean {
  try {
    return PRIOR_KEYS.some((key) => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}

export type WhatsNew = {
  release: Release | null;
  open: boolean;
  close: () => void;
};

/// Resolves the notes for the version this install just moved to, opening them
/// exactly once per version.
export function useWhatsNew(): WhatsNew {
  const [release, setRelease] = useState<Release | null>(null);
  const [open, setOpen] = useState(false);
  // Sampled during the first render, before any effect writes the prior keys,
  // so a brand-new install isn't mistaken for an upgrade.
  const [runBefore] = useState(hasRunBefore);

  useEffect(() => {
    let cancelled = false;
    api
      .getVersion()
      .then((version) => {
        if (cancelled) return;
        const entry = releaseFor(version);
        setRelease(entry);

        const seen = readSeen();
        // First install ever: adopt the current version silently.
        if (seen === null && !runBefore) {
          writeSeen(version);
          return;
        }
        if (seen === version) return;

        writeSeen(version);
        if (entry) setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [runBefore]);

  const close = useCallback(() => setOpen(false), []);

  return { release, open, close };
}
