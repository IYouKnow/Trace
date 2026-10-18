import { Film, Home, Settings, type LucideIcon } from "lucide-react";

export type View = "home" | "library" | "settings";

export type NavEntry = {
  id: View;
  label: string;
  icon: LucideIcon;
};

export const NAV: NavEntry[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "library", label: "Library", icon: Film },
  { id: "settings", label: "Settings", icon: Settings },
];

export type SettingsSection = {
  id: string;
  label: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "recording", label: "Recording" },
  { id: "audio", label: "Audio" },
  { id: "general", label: "General" },
  { id: "hotkeys", label: "Hotkeys" },
  { id: "appearance", label: "Appearance" },
  { id: "storage", label: "Storage" },
  { id: "updates", label: "Updates" },
];
