import type { Release } from "../lib/whatsnew";

type Props = {
  release: Release;
};

/// The feature list for a release, shared by the startup modal and Settings.
export function WhatsNew({ release }: Props) {
  return (
    <ul className="flex flex-col gap-4">
      {release.highlights.map(({ icon: Icon, title, description }) => (
        <li key={title} className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-elevated text-accent">
            <Icon className="size-4" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-ink">{title}</span>
            <span className="text-[13px] leading-relaxed text-ink-muted">
              {description}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
