import { ChevronDown, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { SettingsGroup } from "../../components/ui/SettingsGroup";
import { SettingsRow } from "../../components/ui/SettingsRow";
import { WhatsNew } from "../../components/WhatsNew";
import { api } from "../../lib/api";
import { cx } from "../../lib/cx";
import type { Updater } from "../../lib/updater";
import type { WhatsNew as WhatsNewState } from "../../lib/whatsnew";

type Props = {
  updater: Updater;
  whatsNew: WhatsNewState;
};

export default function UpdatesPage({ updater, whatsNew }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    api
      .getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  const hasUpdate =
    updater.phase === "available" ||
    updater.phase === "downloading" ||
    updater.phase === "ready";

  return (
    <>
      <PageHeader title="Updates" description="Keep Trace up to date." />

      <div className="flex max-w-2xl flex-col gap-6 p-6">
        {updater.phase === "error" && <Banner tone="error">{updater.error}</Banner>}

        {hasUpdate && (
          <Banner tone="info">
            <div className="flex flex-col gap-2">
              <span>Version {updater.version} is available.</span>
              {updater.notes && (
                <span className="line-clamp-3 text-ink-muted">{updater.notes}</span>
              )}
              <div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download className="size-3.5" />}
                  loading={updater.phase === "downloading"}
                  disabled={updater.phase !== "available"}
                  onClick={() => updater.install()}
                >
                  {updater.phase === "downloading"
                    ? `Updating… ${updater.progress ?? 0}%`
                    : "Update & restart"}
                </Button>
              </div>
            </div>
          </Banner>
        )}

        <SettingsGroup title="Version">
          <SettingsRow plain label={`Trace ${version ?? "…"}`}>
            <Button
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              loading={updater.phase === "checking"}
              onClick={() => updater.check()}
            >
              Check for updates
            </Button>
          </SettingsRow>
        </SettingsGroup>

        {whatsNew.release && (
          <SettingsGroup title="What's new">
            <div className="px-4 py-3.5">
              <WhatsNew releases={[whatsNew.release]} />
            </div>
          </SettingsGroup>
        )}

        {whatsNew.previous.length > 0 && (
          <section className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowPrevious((open) => !open)}
              aria-expanded={showPrevious}
              className="flex w-fit cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-[13px] font-semibold text-ink"
            >
              <ChevronDown
                aria-hidden="true"
                className={cx(
                  "size-3.5 transition-transform duration-150",
                  showPrevious && "rotate-180",
                )}
              />
              Previous releases
            </button>
            {showPrevious && (
              <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3.5">
                <WhatsNew releases={whatsNew.previous} />
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
