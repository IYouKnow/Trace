import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { SettingsGroup } from "../../components/ui/SettingsGroup";
import { SettingsRow } from "../../components/ui/SettingsRow";
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
      </div>
    </>
  );
}
