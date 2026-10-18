import { ThemeToggle } from "../../components/ThemeToggle";
import { PageHeader } from "../../components/ui/PageHeader";
import { SettingsGroup } from "../../components/ui/SettingsGroup";
import { SettingsRow } from "../../components/ui/SettingsRow";
import type { Theme } from "../../lib/theme";

type Props = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export default function AppearancePage({ theme, onThemeChange }: Props) {
  return (
    <>
      <PageHeader title="Appearance" description="Match Trace to your desktop." />

      <div className="flex max-w-2xl flex-col gap-6 p-6">
        <SettingsGroup title="Theme">
          <SettingsRow
            plain
            label="Color theme"
            description="System follows your Windows theme."
          >
            <div className="w-[112px]">
              <ThemeToggle theme={theme} onChange={onThemeChange} />
            </div>
          </SettingsRow>
        </SettingsGroup>
      </div>
    </>
  );
}
