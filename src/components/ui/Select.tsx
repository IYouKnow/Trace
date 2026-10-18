import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function Select({ value, onChange, disabled, className, children }: Props) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cx(
        "h-8 w-[200px] cursor-pointer rounded-[6px] border border-line bg-elevated px-2 text-[13px] text-ink transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </select>
  );
}
