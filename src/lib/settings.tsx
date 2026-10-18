import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type AudioDevices, type Settings } from "./api";
import { dismiss, toast } from "./toast";

type Value = {
  settings: Settings | null;
  devices: AudioDevices;
  error: string | null;
  setError: (message: string | null) => void;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<Value | null>(null);

type Props = {
  onSaved: () => void;
  children: ReactNode;
};

export function SettingsProvider({ onSaved, children }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [devices, setDevices] = useState<AudioDevices>({ system: [], microphone: [] });
  const [error, setError] = useState<string | null>(null);
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

  function update(patch: Partial<Settings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }

  return (
    <SettingsContext.Provider value={{ settings, devices, error, setError, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Value {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used within a SettingsProvider");
  return value;
}
