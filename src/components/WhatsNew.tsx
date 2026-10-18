import type { Release } from "../lib/whatsnew";

type Props = {
  releases: Release[];
};

/// The feature list for one or more releases, shared by the startup modal and
/// the Updates settings page.
export function WhatsNew({ releases }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {releases.map((release) => (
        <section key={release.version} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[14px] font-semibold text-ink">{release.title}</h3>
            <span className="text-[12px] text-ink-faint">
              Trace {release.version}
            </span>
          </div>
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
        </section>
      ))}
    </div>
  );
}
