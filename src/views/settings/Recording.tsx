import { Banner } from "../../components/ui/Banner";
import { Disclosure } from "../../components/ui/Disclosure";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { Select } from "../../components/ui/Select";
import { Slider } from "../../components/ui/Slider";
import { useSettings } from "../../lib/settings";

type Props = {
  encoders: string[];
};

export default function RecordingPage({ encoders }: Props) {
  const { settings, update, error } = useSettings();

  const summary = settings
    ? `${settings.fps} fps · ${Math.round(settings.bitrate / 1_000_000)} Mbps · ${
        settings.encoder ?? "Auto"
      }`
    : undefined;

  return (
    <>
      <PageHeader
        title="Recording"
        description="How much footage Trace keeps ready and how it's encoded."
      />

      <div className="flex max-w-2xl flex-col gap-4 p-6">
        {error && <Banner tone="error">{error}</Banner>}

        {!settings ? (
          <p className="text-[13px] text-ink-muted">Loading…</p>
        ) : (
          <>
            <Panel title="Replay buffer">
              <Slider
                label="Replay buffer length"
                min={10}
                max={300}
                step={5}
                value={settings.buffer_seconds}
                onChange={(value) => update({ buffer_seconds: value })}
                format={(value) => `${value}s`}
                hint="How far back Trace can save at any moment."
              />
            </Panel>

            <Disclosure label="Advanced" summary={summary}>
              <Panel title="Video">
                <div className="flex flex-col gap-5">
                  <Select
                    label="Frame rate"
                    value={String(settings.fps)}
                    onChange={(value) => update({ fps: Number(value) })}
                    hint="Higher is smoother but uses more space."
                  >
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </Select>

                  <Slider
                    label="Video bitrate"
                    min={5}
                    max={50}
                    step={1}
                    value={Math.round(settings.bitrate / 1_000_000)}
                    onChange={(value) => update({ bitrate: value * 1_000_000 })}
                    format={(value) => `${value} Mbps`}
                    hint="Higher looks better and makes larger clips."
                  />

                  <Select
                    label="Encoder"
                    value={settings.encoder ?? ""}
                    onChange={(value) => update({ encoder: value || null })}
                    hint="Auto picks the best available encoder for your PC."
                  >
                    <option value="">Auto (recommended)</option>
                    {encoders.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Panel>
            </Disclosure>
          </>
        )}
      </div>
    </>
  );
}
