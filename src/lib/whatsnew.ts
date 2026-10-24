import {
  Activity,
  AppWindow,
  BellRing,
  Cpu,
  Film,
  Gauge,
  Info,
  Keyboard,
  LayoutGrid,
  ListTree,
  Maximize,
  Mic,
  Monitor,
  MonitorCheck,
  Power,
  Rocket,
  Trash,
  Volume2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
    version: "0.6.0",
    title: "Record a single app",
    highlights: [
      {
        icon: AppWindow,
        title: "Record one app instead of everything",
        description:
          "Pick an app and Trace records just that window. The chooser lists everything you have open with its real icon, and the app you're using right now sits at the top so you can find it at a glance.",
      },
      {
        icon: LayoutGrid,
        title: "Whole screen or one app",
        description:
          "Home now has a switch for what you're capturing: choose Whole screen and pick a display, or choose App and pick a window. Change it whenever you like — Trace starts capturing the new target on its own.",
      },
      {
        icon: MonitorCheck,
        title: "Apps that hide in the background still record",
        description:
          "Apps like Discord, Chrome and Slack stop drawing when they aren't the window you're using, which used to come out black. Trace now takes those from the screen instead, so the clip shows what was really there. An app you minimise records as blank rather than freezing on an old frame.",
      },
      {
        icon: Volume2,
        title: "Know which audio device was used",
        description:
          "If the speaker or microphone you chose isn't available — an unplugged headset, a switched-off interface — Trace falls back to your default and tells you which device it used, instead of quietly recording the wrong one.",
      },
    ],
  },
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
  {
    version: "0.4.0",
    title: "Pick your monitor",
    highlights: [
      {
        icon: Monitor,
        title: "Choose a display",
        description:
          "Capture the screen you actually play on. Trace lists every connected monitor so you can pick the right one instead of guessing.",
      },
      {
        icon: MonitorCheck,
        title: "Never lose your capture",
        description:
          "If the monitor you picked gets unplugged, Trace falls back to your primary display rather than failing to start.",
      },
    ],
  },
  {
    version: "0.3.4",
    title: "Update alerts anywhere",
    highlights: [
      {
        icon: BellRing,
        title: "Native update notifications",
        description:
          "When a new version ships, a Windows notification tells you even if Trace is hidden in the tray — click it to jump straight to Updates.",
      },
    ],
  },
  {
    version: "0.3.3",
    title: "Start with Windows",
    highlights: [
      {
        icon: Power,
        title: "Launch at login",
        description:
          "Have Trace open with Windows and wait in the tray, so the replay buffer is already running before you get into a game.",
      },
    ],
  },
  {
    version: "0.3.2",
    title: "Playback and steadier capture",
    highlights: [
      {
        icon: Maximize,
        title: "Fullscreen player",
        description:
          "Clips open in an immersive lightbox with keyboard controls — space to play or pause, arrows to seek, Esc to close.",
      },
      {
        icon: Activity,
        title: "Smoother long sessions",
        description:
          "A larger frame pool and clearer pipeline errors mean fewer dropped frames, and an obvious reason when something does go wrong.",
      },
    ],
  },
  {
    version: "0.3.1",
    title: "Repair broken clips",
    highlights: [
      {
        icon: Wrench,
        title: "Automatic repairs",
        description:
          "Clips whose file was cut short are repaired quietly when the Library opens, so they play properly again.",
      },
      {
        icon: Info,
        title: "Toasts for what happens",
        description:
          "Saving, repairing and other actions confirm themselves with a brief toast instead of leaving you guessing.",
      },
    ],
  },
  {
    version: "0.3.0",
    title: "Tray, trash and shortcuts",
    highlights: [
      {
        icon: AppWindow,
        title: "Runs in the tray",
        description:
          "Trace lives in the system tray with its status and quick actions a click away, so it stays out of your way.",
      },
      {
        icon: Keyboard,
        title: "True global hotkeys",
        description:
          "A low-level keyboard hook makes your shortcuts fire even while a fullscreen game has focus.",
      },
      {
        icon: Trash,
        title: "Deletes you can undo",
        description:
          "Deleting a clip moves it to the Windows Recycle Bin instead of erasing it, so a mistake is easy to take back.",
      },
      {
        icon: Rocket,
        title: "Start recording on launch",
        description:
          "Choose whether Trace begins buffering automatically the moment it opens.",
      },
    ],
  },
  {
    version: "0.2.0",
    title: "Audio, properly",
    highlights: [
      {
        icon: Mic,
        title: "System and microphone capture",
        description:
          "Record game sound, your voice, or both at once — and choose exactly which devices Trace listens to.",
      },
      {
        icon: Volume2,
        title: "Microphone test",
        description:
          "Check your mic from Settings with a live input level, using the same capture path your clips use.",
      },
    ],
  },
  {
    version: "0.1.1",
    title: "Global hotkeys",
    highlights: [
      {
        icon: Keyboard,
        title: "Control Trace from anywhere",
        description:
          "Save a clip or toggle the replay buffer without leaving your game, with your bindings remembered between sessions.",
      },
    ],
  },
  {
    version: "0.1.0",
    title: "The first Trace",
    highlights: [
      {
        icon: Film,
        title: "Replay buffer",
        description:
          "Trace keeps the last few seconds of gameplay in memory, so you can save the moment just after it happens.",
      },
      {
        icon: Cpu,
        title: "Hardware-accelerated capture",
        description:
          "A zero-copy GPU pipeline with hardware encoder support keeps capture light even at high frame rates.",
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
export function releasesSince(after: string, current: string): Release[] {
  return RELEASES.filter((release) => {
    if (compareVersions(release.version, current) > 0) return false;
    if (compareVersions(release.version, after) <= 0) return false;
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
        const current = releaseFor(version);
        setRelease(current);
        setPrevious(olderReleases(version));

        const seen = readSeen();
        // First install ever: adopt the current version silently.
        if (seen === null && !runBefore) {
          writeSeen(version);
          return;
        }

        // A build from before this feature left no marker, so there's no way to
        // know what was already seen — announce only the version it landed on.
        // Otherwise roll up every version skipped since the last seen one.
        const missed =
          seen === null ? (current ? [current] : []) : releasesSince(seen, version);
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
