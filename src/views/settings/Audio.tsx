import { Mic, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { Select } from "../../components/ui/Select";
import {
  api,
  type AudioSource,
  type MicTestStatus,
  type Status,
} from "../../lib/api";
import { useSettings } from "../../lib/settings";

type Props = {
  status: Status | null;
};

export default function AudioPage({ status }: Props) {
  const { settings, devices, update, error, setError } = useSettings();
  const [micTest, setMicTest] = useState<MicTestStatus | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  // Poll the live level while a microphone test is running.
  useEffect(() => {
    if (!micTest?.active) return;
    const timer = setInterval(() => {
      api.micTestStatus().then(setMicTest).catch(() => {});
    }, 100);
    return () => clearInterval(timer);
  }, [micTest?.active]);

  // Stop the test when leaving the page.
  useEffect(
    () => () => {
      api.stopMicTest().catch(() => {});
    },
    [],
  );

  async function startTest() {
    setTestBusy(true);
    setError(null);
    try {
      setMicTest(await api.startMicTest(settings?.microphone_device ?? null));
    } catch (caught) {
      setError(String(caught));
    } finally {
      setTestBusy(false);
    }
  }

  async function stopTest() {
    try {
      await api.stopMicTest();
    } catch {
      /* ignore */
    }
    setMicTest(null);
  }

  return (
    <>
      <PageHeader
        title="Audio"
        description="Choose what Trace records and check your microphone."
      />

      <div className="flex max-w-2xl flex-col gap-4 p-6">
        {error && <Banner tone="error">{error}</Banner>}

        {!settings ? (
          <p className="text-[13px] text-ink-muted">Loading…</p>
        ) : (
          <>
            <Panel title="Sources">
              <div className="flex flex-col gap-5">
                <Select
                  label="What to record"
                  value={settings.audio_source}
                  onChange={(value) => update({ audio_source: value as AudioSource })}
                  hint="Pick the sound sources you want in your clips."
                >
                  <option value="off">Off</option>
                  <option value="system">System audio</option>
                  <option value="microphone">Microphone</option>
                  <option value="both">System + microphone</option>
                </Select>

                {(settings.audio_source === "system" ||
                  settings.audio_source === "both") && (
                  <Select
                    label="System audio device"
                    value={settings.system_device ?? ""}
                    onChange={(value) => update({ system_device: value || null })}
                  >
                    <option value="">System default</option>
                    {devices.system.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </Select>
                )}

                {(settings.audio_source === "microphone" ||
                  settings.audio_source === "both") && (
                  <Select
                    label="Microphone"
                    value={settings.microphone_device ?? ""}
                    onChange={(value) => update({ microphone_device: value || null })}
                  >
                    <option value="">System default</option>
                    {devices.microphone.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </Select>
                )}

                {status?.replaying && status.audio && (
                  <p className="text-[12px] text-ink-faint">Recording: {status.audio}</p>
                )}
              </div>
            </Panel>

            <Panel title="Microphone test">
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-ink-muted">
                  Check that the selected microphone hears you — this uses the same
                  capture path as clips.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  {micTest?.active ? (
                    <Button
                      variant="secondary"
                      icon={<Square className="size-3.5" />}
                      onClick={stopTest}
                    >
                      Stop test
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      loading={testBusy}
                      icon={<Mic className="size-3.5" />}
                      onClick={startTest}
                    >
                      Test microphone
                    </Button>
                  )}
                  {micTest?.device && (
                    <span className="text-[12px] text-ink-faint">{micTest.device}</span>
                  )}
                </div>

                {micTest?.active && (
                  <div className="flex flex-col gap-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-75"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((micTest.level ?? 0) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-[12px] text-ink-faint">
                      {micTest.peak > 0.01
                        ? "Signal detected"
                        : "Listening… speak or tap the microphone"}
                    </p>
                  </div>
                )}

                <p className="text-[12px] text-ink-faint">
                  Pick a device above — clips use it automatically.
                </p>
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
