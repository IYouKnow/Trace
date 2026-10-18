import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function SettingsGroup({ title, description, children }: Props) {
  return (
    <section className="flex flex-col gap-2">
      {(title || description) && (
        <div className="flex flex-col gap-0.5 px-1">
          {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
          {description && (
            <p className="text-[12px] text-ink-faint">{description}</p>
          )}
        </div>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
        {children}
      </div>
    </section>
  );
}
