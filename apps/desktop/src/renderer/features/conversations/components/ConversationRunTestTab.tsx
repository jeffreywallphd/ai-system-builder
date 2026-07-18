import { useMemo } from "react";
import { ConversationRunTest } from "../../../../../../../modules/ui/shared/system-builder/ConversationRunTest";
import { createDesktopExecutionPlansClient } from "../../execution-plans/api/desktopExecutionPlansClient";
import { createDesktopConversationExecutionClient } from "../api/desktopConversationExecutionClient";

export function ConversationRunTestTab({
  workspaceId,
}: {
  readonly workspaceId: string;
}) {
  const plansClient = useMemo(() => createDesktopExecutionPlansClient(), []);
  const client = useMemo(() => createDesktopConversationExecutionClient(), []);
  return (
    <ConversationRunTest
      workspaceId={workspaceId}
      plansClient={plansClient}
      client={client}
    />
  );
}
