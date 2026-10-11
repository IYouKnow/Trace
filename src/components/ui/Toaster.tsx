import { Info, X } from "lucide-react";
import { dismiss, useToasts } from "../../lib/toast";

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className="toast-in pointer-events-auto flex w-[min(380px,100%)] items-start gap-2.5 rounded-[var(--radius-control)] border border-line bg-elevated px-3.5 py-2.5 text-[13px] shadow-lg"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1 leading-relaxed">{item.message}</div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
            className="-mr-1 grid size-6 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
