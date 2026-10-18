import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./components/AppShell";
import { Sidebar } from "./components/Sidebar";
import { Toaster } from "./components/ui/Toaster";
import { UpdateBar } from "./components/UpdateBar";
import { WhatsNewDialog } from "./components/WhatsNewDialog";
import { api, type Status } from "./lib/api";
import { SETTINGS_SECTIONS, type View } from "./lib/nav";
import { initNotifications } from "./lib/notifications";
import { SettingsProvider } from "./lib/settings";
import { useSidebarCollapsed } from "./lib/sidebar";
import { useTheme } from "./lib/theme";
import { useUpdater } from "./lib/updater";
import { useWhatsNew } from "./lib/whatsnew";
import Home from "./views/Home";
import Library from "./views/Library";
import SettingsView from "./views/Settings";

export default function App() {
  const { theme, setTheme } = useTheme();
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const [view, setView] = useState<View>("home");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState(SETTINGS_SECTIONS[0].id);
  const updater = useUpdater();
  const whatsNew = useWhatsNew();

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.getStatus());
      setError(null);
    } catch (caught) {
      setError(String(caught));
    }
  }, []);

  const openSettingsSection = useCallback((id: string) => {
    setView("settings");
    setSettingsSection(id);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  // The tray can ask the UI to switch views (e.g. "Open Library").
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("navigate", (event) => setView(event.payload as View))
      .then((stop) => {
        unlisten = stop;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  // Register the toast button before the first check: desktop only renders a
  // notification's actions while an onAction listener exists. Then check for a
  // new release once at startup; the result lights up Settings.
  useEffect(() => {
    initNotifications().finally(() => updater.check({ silent: true }));
  }, [updater.check]);

  return (
    <SettingsProvider onSaved={refresh}>
      <AppShell
        sidebar={
          <Sidebar
            view={view}
            onSelect={setView}
            theme={theme}
            onThemeChange={setTheme}
            replaying={status?.replaying ?? false}
            collapsed={collapsed}
            onToggle={toggleSidebar}
            settingsSection={settingsSection}
            onSelectSection={openSettingsSection}
          />
        }
        bar={<UpdateBar updater={updater} />}
      >
        {view === "home" && (
          <Home status={status} pollError={error} onChanged={refresh} />
        )}
        {view === "library" && <Library />}
        {view === "settings" && (
          <SettingsView
            section={settingsSection}
            status={status}
            theme={theme}
            onThemeChange={setTheme}
            updater={updater}
            whatsNew={whatsNew}
          />
        )}
        <Toaster />
        {whatsNew.open && whatsNew.release && (
          <WhatsNewDialog release={whatsNew.release} onClose={whatsNew.close} />
        )}
      </AppShell>
    </SettingsProvider>
  );
}
