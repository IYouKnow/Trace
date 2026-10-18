import type { Status } from "../lib/api";
import type { Theme } from "../lib/theme";
import type { Updater } from "../lib/updater";
import AppearancePage from "./settings/Appearance";
import CapturePage from "./settings/Capture";
import GeneralPage from "./settings/General";
import HotkeysPage from "./settings/Hotkeys";
import StoragePage from "./settings/Storage";
import UpdatesPage from "./settings/Updates";

type Props = {
  section: string;
  status: Status | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  updater: Updater;
};

export default function SettingsView({
  section,
  status,
  theme,
  onThemeChange,
  updater,
}: Props) {
  switch (section) {
    case "general":
      return <GeneralPage />;
    case "hotkeys":
      return <HotkeysPage />;
    case "appearance":
      return <AppearancePage theme={theme} onThemeChange={onThemeChange} />;
    case "storage":
      return <StoragePage clipsDir={status?.clips_dir} />;
    case "updates":
      return <UpdatesPage updater={updater} />;
    default:
      return <CapturePage status={status} />;
  }
}
