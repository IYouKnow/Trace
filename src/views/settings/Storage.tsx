import { FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { api } from "../../lib/api";

type Props = {
  clipsDir: string | undefined;
};

export default function StoragePage({ clipsDir }: Props) {
  return (
    <>
      <PageHeader title="Storage" description="Where your saved clips live." />

      <div className="flex max-w-2xl flex-col gap-4 p-6">
        <Panel title="Clips folder">
          <div className="flex items-center justify-between gap-4">
            <p className="break-all text-[13px] text-ink-muted">{clipsDir ?? "—"}</p>
            <Button
              size="sm"
              disabled={!clipsDir}
              icon={<FolderOpen className="size-3.5" />}
              onClick={() => clipsDir && api.openClip(clipsDir)}
            >
              Open folder
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
