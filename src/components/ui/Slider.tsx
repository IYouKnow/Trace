type Props = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
};

export function Slider({ label, min, max, step, value, onChange, format, hint }: Props) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-elevated accent-accent"
        />
        <output className="w-[76px] text-right text-[13px] tabular-nums text-ink-muted">
          {format ? format(value) : value}
        </output>
      </div>
      {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
    </label>
  );
}
