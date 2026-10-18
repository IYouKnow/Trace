import { ChevronDown } from "lucide-react";
import { cx } from "../lib/cx";
import type { NavEntry } from "../lib/nav";

type Props = {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  expandable?: boolean;
  expanded?: boolean;
};

export function NavItem({
  entry,
  active,
  collapsed,
  onSelect,
  expandable,
  expanded,
}: Props) {
  const Icon = entry.icon;
  const showChevron = expandable && !collapsed;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={collapsed ? entry.label : undefined}
      aria-label={entry.label}
      aria-current={active ? "page" : undefined}
      aria-expanded={showChevron ? expanded : undefined}
      className={cx(
        "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm transition-colors duration-150",
        collapsed && "justify-center px-0",
        active
          ? "bg-elevated font-medium text-ink"
          : "text-ink-muted hover:bg-elevated/60 hover:text-ink",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left">{entry.label}</span>}
      {showChevron && (
        <ChevronDown
          aria-hidden="true"
          className={cx(
            "size-3.5 shrink-0 transition-transform duration-150",
            expanded && "rotate-180",
          )}
        />
      )}
    </button>
  );
}
