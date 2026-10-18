import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { api } from "../../lib/api";
import type { Updater } from "../../lib/updater";

type Props = {
  updater: Updater;
};

export default function UpdatesPage({ updater }: Props) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    api
      .getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  return (
    <>
      <PageHeader title="Updates" description="Keep Trace up to date." />

      <div className="flex max-w-2xl flex-col gap-4 p-6">
        <Panel title="Version">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] text-ink-muted">Trace {version ?? "…"}</p>
              <Button
                size="sm"
                icon={<RefreshCw className="size-3.5" />}
                loading={updater.phase === "checking"}
                onClick={() => updater.check()}
              >
                Check for updates
              </Button>
            </div>

            {(updater.phase === "available" ||
              updater.phase === "downloading" ||
              updater.phase === "ready") && (
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

            {updater.phase === "error" && <Banner tone="error">{updater.error}</Banner>}
          </div>
        </Panel>
      </div>
    </>
  );
}
