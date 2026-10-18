import type { Status } from "../lib/api";
import type { Theme } from "../lib/theme";
import type { Updater } from "../lib/updater";
import type { WhatsNew } from "../lib/whatsnew";
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
  whatsNew: WhatsNew;
};

export default function SettingsView({
  section,
  status,
  theme,
  onThemeChange,
  updater,
  whatsNew,
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
      return <UpdatesPage updater={updater} whatsNew={whatsNew} />;
    default:
      return <CapturePage status={status} />;
  }
}
