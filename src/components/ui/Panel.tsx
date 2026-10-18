import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

type Props = {
  className?: string;
  children: ReactNode;
};

export function Panel({ className, children }: Props) {
  return (
    <section
      className={cx(
        "rounded-[var(--radius-panel)] border border-line bg-surface p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
