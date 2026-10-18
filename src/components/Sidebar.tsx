import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "../lib/cx";
import { NAV, SETTINGS_SECTIONS, type View } from "../lib/nav";
import type { Theme } from "../lib/theme";
import { NavItem } from "./NavItem";
import { StatusPill } from "./StatusPill";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  view: View;
  onSelect: (view: View) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  replaying: boolean;
  collapsed: boolean;
  onToggle: () => void;
  settingsSection: string;
  onSelectSection: (id: string) => void;
};

export function Sidebar({
  view,
  onSelect,
  theme,
  onThemeChange,
  replaying,
  collapsed,
  onToggle,
  settingsSection,
  onSelectSection,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Reveal the section list whenever the user lands on Settings.
  useEffect(() => {
    if (view === "settings") setSettingsOpen(true);
  }, [view]);

  function select(id: View) {
    if (id !== "settings") {
      onSelect(id);
      return;
    }
    // Clicking Settings opens the section list (and goes there); clicking it
    // again closes the list.
    if (view === "settings") {
      setSettingsOpen((open) => !open);
    } else {
      onSelect("settings");
    }
  }

  return (
    <aside
      className={cx(
        "flex shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-[220px]",
      )}
    >
      <div
        className={cx("flex h-10 shrink-0 items-center gap-2", collapsed ? "px-2" : "px-3")}
      >
        <div data-tauri-drag-region className="flex flex-1 items-center self-stretch">
          {!collapsed && (
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-ink">
              Trace
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-1 pb-2"
      >
        {NAV.map((entry) => {
          const isSettings = entry.id === "settings";
          return (
            <div key={entry.id} className="flex flex-col gap-0.5">
              <NavItem
                entry={entry}
                active={view === entry.id}
                collapsed={collapsed}
                onSelect={() => select(entry.id)}
                expandable={isSettings}
                expanded={isSettings ? settingsOpen : undefined}
              />

              {isSettings && settingsOpen && !collapsed && (
                <ul className="ml-5 flex flex-col gap-0.5 border-l border-line pl-1.5">
                  {SETTINGS_SECTIONS.map((section) => {
                    const active =
                      view === "settings" && settingsSection === section.id;
                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          onClick={() => onSelectSection(section.id)}
                          aria-current={active ? "true" : undefined}
                          className={cx(
                            "flex h-7 w-full cursor-pointer items-center rounded-[6px] px-2.5 text-[13px] transition-colors duration-150",
                            active
                              ? "font-medium text-ink"
                              : "text-ink-faint hover:bg-elevated/60 hover:text-ink",
                          )}
                        >
                          <span className="truncate">{section.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-line p-2">
        <StatusPill replaying={replaying} collapsed={collapsed} />
        <ThemeToggle theme={theme} collapsed={collapsed} onChange={onThemeChange} />
      </div>
    </aside>
  );
}
