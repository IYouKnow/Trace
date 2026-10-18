import { cx } from "../../lib/cx";

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  className?: string;
};

export function Slider({ min, max, step, value, onChange, format, className }: Props) {
  return (
    <span className={cx("flex w-[260px] items-center gap-3", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-elevated accent-accent"
      />
      <output className="w-14 shrink-0 text-right text-[13px] tabular-nums text-ink-muted">
        {format ? format(value) : value}
      </output>
    </span>
  );
}
