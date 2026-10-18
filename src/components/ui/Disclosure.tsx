import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";

type Props = {
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Disclosure({ label, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
      >
        <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          <ChevronRight
            aria-hidden="true"
            className={cx(
              "size-3.5 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
          {label}
        </span>
        {summary && <span className="text-[12px] text-ink-faint">{summary}</span>}
      </button>

      {open && (
        <div id={contentId} className="flex flex-col gap-4">
          {children}
        </div>
      )}
    </div>
  );
}
