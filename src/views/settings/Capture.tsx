import { Mic, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { SettingsGroup } from "../../components/ui/SettingsGroup";
import { SettingsRow } from "../../components/ui/SettingsRow";
import { Slider } from "../../components/ui/Slider";
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

export default function CapturePage({ status }: Props) {
  const { settings, devices, update, error, setError } = useSettings();
  const [micTest, setMicTest] = useState<MicTestStatus | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const encoders = status?.available_encoders ?? [];
  const usesSystem =
    settings?.audio_source === "system" || settings?.audio_source === "both";
  const usesMicrophone =
    settings?.audio_source === "microphone" || settings?.audio_source === "both";

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

  // The stored bitrate is a 60 fps reference; the slider shows what the encoder
  // uses at the selected frame rate (20 Mbps at 60 fps, 40 at 120, and so on),
  // so it follows the frame-rate dropdown without the user touching it.
  const fpsScale = (settings?.fps ?? 60) / 60;
  const bitrateMbps = Math.round(((settings?.bitrate ?? 0) * fpsScale) / 1_000_000);

  return (
    <>
      <PageHeader
        title="Capture"
        description="What Trace records and how it's encoded."
      />

      <div className="flex max-w-2xl flex-col gap-6 p-6">
        {error && <Banner tone="error">{error}</Banner>}

        {!settings ? (
          <p className="text-[13px] text-ink-muted">Loading…</p>
        ) : (
          <>
            <SettingsGroup
              title="Replay buffer"
              description="How far back Trace can save at any moment."
            >
              <SettingsRow label="Buffer length">
                <Slider
                  min={10}
                  max={300}
                  step={5}
                  value={settings.buffer_seconds}
                  onChange={(value) => update({ buffer_seconds: value })}
                  format={(value) => `${value}s`}
                />
              </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title="Video">
              <SettingsRow label="Frame rate">
                <Select
                  value={String(settings.fps)}
                  onChange={(value) => update({ fps: Number(value) })}
                >
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                  <option value="90">90 fps</option>
                  <option value="120">120 fps</option>
                  <option value="144">144 fps</option>
                  <option value="240">240 fps</option>
                </Select>
              </SettingsRow>

              <SettingsRow label="Bitrate">
                <Slider
                  min={Math.floor(5 * fpsScale)}
                  max={Math.ceil(50 * fpsScale)}
                  step={1}
                  value={bitrateMbps}
                  onChange={(value) =>
                    update({
                      bitrate: Math.round((value * 1_000_000) / fpsScale),
                    })
                  }
                  format={(value) => `${value} Mbps`}
                />
              </SettingsRow>

              <SettingsRow
                label="Encoder"
                description="Auto picks the best encoder for your PC."
              >
                <Select
                  value={settings.encoder ?? ""}
                  onChange={(value) => update({ encoder: value || null })}
                >
                  <option value="">Auto</option>
                  {encoders.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </SettingsRow>
            </SettingsGroup>

            <SettingsGroup
              title="Audio"
              description="Pick the sound sources you want in your clips."
            >
              <SettingsRow label="Source">
                <Select
                  value={settings.audio_source}
                  onChange={(value) =>
                    update({ audio_source: value as AudioSource })
                  }
                >
                  <option value="off">Off</option>
                  <option value="system">System audio</option>
                  <option value="microphone">Microphone</option>
                  <option value="both">System + microphone</option>
                </Select>
              </SettingsRow>

              {usesSystem && (
                <SettingsRow label="System device">
                  <Select
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
                </SettingsRow>
              )}

              {usesMicrophone && (
                <SettingsRow label="Microphone">
                  <Select
                    value={settings.microphone_device ?? ""}
                    onChange={(value) =>
                      update({ microphone_device: value || null })
                    }
                  >
                    <option value="">System default</option>
                    {devices.microphone.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </Select>
                </SettingsRow>
              )}

              {status?.replaying && status.audio && (
                <SettingsRow
                  plain
                  label="Now recording"
                  description={status.audio}
                />
              )}
            </SettingsGroup>

            <SettingsGroup
              title="Microphone test"
              description="Runs the same capture path your clips use."
            >
              <SettingsRow label="Input level">
                {micTest?.active ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Square className="size-3.5" />}
                    onClick={stopTest}
                  >
                    Stop test
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={testBusy}
                    icon={<Mic className="size-3.5" />}
                    onClick={startTest}
                  >
                    Test microphone
                  </Button>
                )}
              </SettingsRow>

              {micTest?.active && (
                <div className="flex flex-col gap-2 px-4 py-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
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
                  <span className="text-[12px] text-ink-faint">
                    {micTest.peak > 0.01
                      ? "Signal detected"
                      : "Listening… speak or tap the microphone"}
                    {micTest.device ? ` · ${micTest.device}` : ""}
                  </span>
                </div>
              )}
            </SettingsGroup>
          </>
        )}
      </div>
    </>
  );
}
