import { Sparkles, X } from "lucide-react";
import type { Release } from "../lib/whatsnew";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { WhatsNew } from "./WhatsNew";

type Props = {
  releases: Release[];
  onClose: () => void;
};

/// Announces what a freshly installed update changed, including any versions
/// the user skipped. Shown once per update.
export function WhatsNewDialog({ releases, onClose }: Props) {
  return (
    <Modal
      title="What's new"
      onClose={onClose}
      width="max-w-md"
      closeOnBackdrop={false}
    >
      <div className="flex flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
            <Sparkles className="size-3.5" />
            What's new
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <WhatsNew releases={releases} />

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose} autoFocus>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
