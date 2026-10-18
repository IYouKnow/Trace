import { Download, FolderOpen, Mic, RefreshCw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Disclosure } from "../components/ui/Disclosure";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { Switch } from "../components/ui/Switch";
import {
  api,
  type AudioDevices,
  type AudioSource,
  type MicTestStatus,
  type Settings,
  type Status,
} from "../lib/api";
import { SETTINGS_SECTIONS, type SettingsTarget } from "../lib/nav";
import type { Theme } from "../lib/theme";
import { dismiss, toast } from "../lib/toast";
import type { Updater } from "../lib/updater";

type Props = {
  status: Status | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onSaved: () => void;
  updater: Updater;
  target: SettingsTarget | null;
  onSectionChange: (id: string) => void;
};

export default function SettingsView({
  status,
  theme,
  onThemeChange,
  onSaved,
  updater,
  target,
  onSectionChange,
}: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [devices, setDevices] = useState<AudioDevices>({ system: [], microphone: [] });
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micTest, setMicTest] = useState<MicTestStatus | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const savedRef = useRef<string | null>(null);
  const toastRef = useRef<number | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((loaded) => {
        savedRef.current = JSON.stringify(loaded);
        setSettings(loaded);
      })
      .catch((caught) => setError(String(caught)));
    api
      .listAudioDevices()
      .then(setDevices)
      .catch(() => {});
    api
      .getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  // Persist changes as they happen; the debounce coalesces slider drags.
  useEffect(() => {
    if (!settings) return;
    const json = JSON.stringify(settings);
    if (json === savedRef.current) return;

    const handle = window.setTimeout(async () => {
      try {
        await api.setSettings(settings);
        savedRef.current = json;
        setError(null);
        onSaved();
        if (toastRef.current !== null) dismiss(toastRef.current);
        toastRef.current = toast("Settings saved", 1800);
      } catch (caught) {
        setError(String(caught));
        toast(`Couldn't save settings: ${caught}`, 6000);
      }
    }, 500);

    return () => window.clearTimeout(handle);
  }, [settings, onSaved]);

  // Scroll to a section the sidebar asked for.
  useEffect(() => {
    if (!target) return;
    document
      .getElementById(target.id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [target]);

  // Report the section in view so the sidebar can highlight it.
  useEffect(() => {
    const elements = SETTINGS_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) onSectionChange(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [onSectionChange]);

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

  function update(patch: Partial<Settings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }

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

  const encoders = status?.available_encoders ?? [];
  const clipsDir = status?.clips_dir;
  const advancedSummary = settings
    ? `${settings.fps} fps · ${Math.round(settings.bitrate / 1_000_000)} Mbps · ${
        settings.encoder ?? "Auto"
      }`
    : undefined;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Recording, audio, and how Trace behaves."
      />

      <div className="max-w-2xl p-6">
        <div className="flex min-w-0 flex-col gap-4">
          {error && <Banner tone="error">{error}</Banner>}

          <div id="recording" className="scroll-mt-24">
            <Panel title="Recording">
              {!settings ? (
                <p className="text-[13px] text-ink-muted">Loading…</p>
              ) : (
                <div className="flex flex-col gap-5">
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

                  <div className="border-t border-line pt-5">
                    <Disclosure label="Advanced" summary={advancedSummary}>
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
                    </Disclosure>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div id="audio" className="scroll-mt-24">
            <Panel title="Audio">
              {!settings ? (
                <p className="text-[13px] text-ink-muted">Loading…</p>
              ) : (
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

                  <div className="flex flex-col gap-3 border-t border-line pt-5">
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
                </div>
              )}
            </Panel>
          </div>

          <div id="general" className="scroll-mt-24">
            <Panel title="General">
              {!settings ? (
                <p className="text-[13px] text-ink-muted">Loading…</p>
              ) : (
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
              )}
            </Panel>
          </div>

          <div id="appearance" className="scroll-mt-24">
            <Panel title="Appearance">
              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-ink-muted">Theme</span>
                <div className="max-w-[220px]">
                  <ThemeToggle theme={theme} onChange={onThemeChange} />
                </div>
                <p className="text-[12px] text-ink-faint">
                  System follows your Windows theme.
                </p>
              </div>
            </Panel>
          </div>

          <div id="storage" className="scroll-mt-24">
            <Panel title="Storage">
              <div className="flex items-center justify-between gap-4">
                <p className="break-all text-[13px] text-ink-muted">{clipsDir ?? "—"}</p>
                <Button
                  size="sm"
                  disabled={!clipsDir}
                  icon={<FolderOpen className="size-3.5" />}
                  onClick={() => clipsDir && api.openClip(clipsDir)}
                >
                  Open folder
                </Button>
              </div>
            </Panel>
          </div>

          <div id="updates" className="scroll-mt-24">
            <Panel title="Updates">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[13px] text-ink-muted">Trace {version ?? "…"}</p>
                  <Button
                    size="sm"
                    icon={<RefreshCw className="size-3.5" />}
                    loading={updater.phase === "checking"}
                    onClick={() => updater.check()}
                  >
                    Check for updates
                  </Button>
                </div>

                {(updater.phase === "available" ||
                  updater.phase === "downloading" ||
                  updater.phase === "ready") && (
                  <Banner tone="info">
                    <div className="flex flex-col gap-2">
                      <span>Version {updater.version} is available.</span>
                      {updater.notes && (
                        <span className="line-clamp-3 text-ink-muted">{updater.notes}</span>
                      )}
                      <div>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Download className="size-3.5" />}
                          loading={updater.phase === "downloading"}
                          disabled={updater.phase !== "available"}
                          onClick={() => updater.install()}
                        >
                          {updater.phase === "downloading"
                            ? `Updating… ${updater.progress ?? 0}%`
                            : "Update & restart"}
                        </Button>
                      </div>
                    </div>
                  </Banner>
                )}

                {updater.phase === "error" && (
                  <Banner tone="error">{updater.error}</Banner>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
