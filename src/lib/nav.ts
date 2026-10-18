import {
  Film,
  Home,
  Keyboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type View = "home" | "library" | "settings" | "hotkeys";

export type NavEntry = {
  id: View;
  label: string;
  icon: LucideIcon;
};

export const NAV: NavEntry[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "library", label: "Library", icon: Film },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "hotkeys", label: "Hotkeys", icon: Keyboard },
];

export type SettingsSection = {
  id: string;
  label: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "recording", label: "Recording" },
  { id: "audio", label: "Audio" },
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "storage", label: "Storage" },
  { id: "updates", label: "Updates" },
];

/// A request to scroll a Settings section into view; `nonce` lets the same
/// section be re-requested.
export type SettingsTarget = {
  id: string;
  nonce: number;
};
