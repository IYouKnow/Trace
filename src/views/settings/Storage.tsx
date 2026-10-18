import { FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { SettingsGroup } from "../../components/ui/SettingsGroup";
import { SettingsRow } from "../../components/ui/SettingsRow";
import { api } from "../../lib/api";

type Props = {
  clipsDir: string | undefined;
};

export default function StoragePage({ clipsDir }: Props) {
  return (
    <>
      <PageHeader title="Storage" description="Where your saved clips live." />

      <div className="flex max-w-2xl flex-col gap-6 p-6">
        <SettingsGroup title="Clips folder">
          <SettingsRow plain label="Location" description={clipsDir ?? "—"}>
            <Button
              size="sm"
              disabled={!clipsDir}
              icon={<FolderOpen className="size-3.5" />}
              onClick={() => clipsDir && api.openClip(clipsDir)}
            >
              Open folder
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </div>
    </>
  );
}
