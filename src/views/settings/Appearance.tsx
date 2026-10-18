import { ThemeToggle } from "../../components/ThemeToggle";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import type { Theme } from "../../lib/theme";

type Props = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export default function AppearancePage({ theme, onThemeChange }: Props) {
  return (
    <>
      <PageHeader title="Appearance" description="Match Trace to your desktop." />

      <div className="flex max-w-2xl flex-col gap-4 p-6">
        <Panel title="Theme">
          <div className="flex flex-col gap-2">
            <div className="max-w-[220px]">
              <ThemeToggle theme={theme} onChange={onThemeChange} />
            </div>
            <p className="text-[12px] text-ink-faint">
              System follows your Windows theme.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
