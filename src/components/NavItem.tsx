import { ChevronDown } from "lucide-react";
import { cx } from "../lib/cx";
import type { NavEntry } from "../lib/nav";

type Props = {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  expanded?: boolean;
  onToggle?: () => void;
};

const ROW =
  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm transition-colors duration-150";

export function NavItem({
  entry,
  active,
  collapsed,
  onSelect,
  expanded,
  onToggle,
}: Props) {
  const Icon = entry.icon;
  const stateClasses = cx(
    collapsed && "justify-center px-0",
    active
      ? "bg-elevated font-medium text-ink"
      : "text-ink-muted hover:bg-elevated/60 hover:text-ink",
  );

  if (!onToggle || collapsed) {
    return (
      <button
        type="button"
        onClick={onSelect}
        title={collapsed ? entry.label : undefined}
        aria-label={entry.label}
        aria-current={active ? "page" : undefined}
        className={cx(ROW, stateClasses)}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && entry.label}
      </button>
    );
  }

  return (
    <div className={cx("flex items-center rounded-[var(--radius-control)]", stateClasses)}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2.5 text-left text-sm"
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{entry.label}</span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${entry.label}` : `Expand ${entry.label}`}
        className="mr-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
      >
        <ChevronDown
          className={cx("size-3.5 transition-transform duration-150", expanded && "rotate-180")}
        />
      </button>
    </div>
  );
}
