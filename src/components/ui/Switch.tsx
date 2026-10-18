import { cx } from "../../lib/cx";

type Props = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Switch({ label, description, checked, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-6 px-4 py-2.5 text-left transition-colors hover:bg-elevated/40"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-ink">{label}</span>
        {description && (
          <span className="text-[12px] text-ink-faint">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150",
          checked ? "border-transparent bg-accent" : "border-line bg-elevated",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-3.5 rounded-full transition-[left] duration-150",
            checked ? "left-[18px] bg-accent-ink" : "left-0.5 bg-ink-faint",
          )}
        />
      </span>
    </button>
  );
}
