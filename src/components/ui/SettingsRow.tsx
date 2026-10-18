import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

type Props = {
  label: string;
  description?: string;
  plain?: boolean;
  children?: ReactNode;
};

const ROW = "flex min-h-[52px] w-full items-center justify-between gap-6 px-4 py-2.5";

export function SettingsRow({ label, description, plain, children }: Props) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-ink">{label}</span>
        {description && (
          <span className="break-all text-[12px] text-ink-faint">{description}</span>
        )}
      </span>
      {children && (
        <span className="flex shrink-0 items-center justify-end gap-2">{children}</span>
      )}
    </>
  );

  if (plain) {
    return <div className={cx(ROW, "text-left")}>{body}</div>;
  }

  return <label className={cx(ROW, "cursor-default")}>{body}</label>;
}
