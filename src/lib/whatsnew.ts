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

/// Compares dotted versions; a missing or non-numeric part counts as zero.
function compareVersions(a: string, b: string): number {
  const left = a.replace(/^v/, "").split(".");
  const right = b.replace(/^v/, "").split(".");
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (Number(left[i]) || 0) - (Number(right[i]) || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/// Notes for the running version, or null when it isn't a tracked release.
export function releaseFor(version: string | null): Release | null {
  if (!version) return null;
  const normalized = version.replace(/^v/, "");
  return RELEASES.find((release) => release.version === normalized) ?? null;
}

/// Releases newer than `after`, up to and including `current`, newest first.
/// `after` is the last version the user saw; null means "up to and including".
export function releasesSince(after: string | null, current: string): Release[] {
  return RELEASES.filter((release) => {
    if (compareVersions(release.version, current) > 0) return false;
    if (after !== null && compareVersions(release.version, after) <= 0) return false;
    return true;
  });
}

/// Releases older than `version`, newest first.
export function olderReleases(version: string): Release[] {
  return RELEASES.filter((release) => compareVersions(release.version, version) < 0);
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
  /** Notes for the running version, if it shipped user-facing changes. */
  release: Release | null;
  /** Older releases, newest first, for the history in Settings. */
  previous: Release[];
  /** Releases to announce: everything since the last version the user saw. */
  pending: Release[];
  open: boolean;
  close: () => void;
};

/// Resolves the notes for the version this install just moved to, opening
/// everything the user missed exactly once.
export function useWhatsNew(): WhatsNew {
  const [release, setRelease] = useState<Release | null>(null);
  const [previous, setPrevious] = useState<Release[]>([]);
  const [pending, setPending] = useState<Release[]>([]);
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
        setRelease(releaseFor(version));
        setPrevious(olderReleases(version));

        const seen = readSeen();
        // First install ever: adopt the current version silently.
        if (seen === null && !runBefore) {
          writeSeen(version);
          return;
        }

        // Skipped versions are announced too; a normal update yields just one.
        const missed = releasesSince(seen, version);
        writeSeen(version);
        if (missed.length > 0) {
          setPending(missed);
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [runBefore]);

  const close = useCallback(() => setOpen(false), []);

  return { release, previous, pending, open, close };
}
