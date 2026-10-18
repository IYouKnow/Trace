import { Banner } from "../../components/ui/Banner";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { Switch } from "../../components/ui/Switch";
import { useSettings } from "../../lib/settings";

export default function GeneralPage() {
  const { settings, update, error } = useSettings();

  return (
    <>
      <PageHeader
        title="General"
        description="How Trace starts up and behaves with Windows."
      />

      <div className="flex max-w-2xl flex-col gap-4 p-6">
        {error && <Banner tone="error">{error}</Banner>}

        {!settings ? (
          <p className="text-[13px] text-ink-muted">Loading…</p>
        ) : (
          <Panel title="Startup">
            <div className="flex flex-col gap-5">
              <Switch
                label="Start recording when Trace opens"
                description="Begin capturing automatically whenever Trace starts."
                checked={settings.auto_start}
                onChange={(value) => update({ auto_start: value })}
              />
              <Switch
                label="Open Trace when I sign in"
                description="Launch Trace to the tray when you sign in to Windows."
                checked={settings.launch_at_login}
                onChange={(value) => update({ launch_at_login: value })}
              />
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
