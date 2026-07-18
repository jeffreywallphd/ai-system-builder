import { useMemo } from "react";
import { ConversationRunTest } from "../../../../../../modules/ui/shared/system-builder/ConversationRunTest";
import { createThinClientExecutionPlansClient } from "../../execution-plans/api/thinClientExecutionPlansClient";
import { createThinClientConversationExecutionClient } from "../api/thinClientConversationExecutionClient";

export function ConversationRunTestTab({
  workspaceId,
}: {
  readonly workspaceId: string;
}) {
  const plansClient = useMemo(() => createThinClientExecutionPlansClient(), []);
  const client = useMemo(
    () => createThinClientConversationExecutionClient(),
    [],
  );
  return (
    <ConversationRunTest
      workspaceId={workspaceId}
      plansClient={plansClient}
      client={client}
    />
  );
}
