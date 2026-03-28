import { useMemo, useState } from "react";
import { AssetDraftLifecycleStatuses } from "../../../domain/studio-shell/StudioShellDomain";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemRuntimeRunPanelProps {
  readonly context: StudioShellExtensionContext;
}

export function SystemRuntimeRunPanel({ context }: SystemRuntimeRunPanelProps): JSX.Element {
  const [message, setMessage] = useState<string | undefined>();
  const [latestExecutionId, setLatestExecutionId] = useState<string | undefined>();
  const [latestStatus, setLatestStatus] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);

  const draft = context.snapshot?.draft;
  const canRun = useMemo(() => {
    if (!draft) {
      return false;
    }
    return draft.lifecycleStatus === AssetDraftLifecycleStatuses.validated
      || draft.lifecycleStatus === AssetDraftLifecycleStatuses.published;
  }, [draft]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-runtime-run-panel">
      <p className="ui-text-muted">
        Trigger bounded runtime execution for the current System Studio draft. This uses the real desktop backend runtime API path.
      </p>
      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="ui-button ui-button--primary"
          disabled={context.isBusy || isRunning || !canRun || !draft?.draftId || !context.operations.startSystemExecution}
          onClick={() => {
            if (!draft?.draftId || !context.operations.startSystemExecution) {
              return;
            }
            setIsRunning(true);
            setMessage(undefined);
            void context.operations.startSystemExecution({
              studioId: context.studioId,
              draftId: draft.draftId,
              context: {
                trigger: "manual",
                actorId: "system-studio-ui",
              },
            }).then(async (response) => {
              if (!response.ok || !response.data) {
                setMessage(response.error?.message ?? "Runtime execution failed to start.");
                return;
              }

              setLatestExecutionId(response.data.executionId);
              setLatestStatus(response.data.status);
              setMessage(`Started execution '${response.data.executionId}' with status '${response.data.status}'.`);

              if (context.operations.getSystemExecutionStatus) {
                const status = await context.operations.getSystemExecutionStatus(response.data.executionId);
                if (status.ok && status.data) {
                  setLatestStatus(status.data.status);
                }
              }
            }).finally(() => {
              setIsRunning(false);
            });
          }}
        >
          {isRunning ? "Starting Run..." : "Run System"}
        </button>
        <span className="ui-text-muted">
          {canRun
            ? "Runtime start is enabled for validated/published drafts."
            : "Validate or publish the draft before running."}
        </span>
      </div>
      {latestExecutionId ? (
        <div className="ui-stack ui-stack--2xs">
          <div><strong>Execution:</strong> {latestExecutionId}</div>
          <div><strong>Status:</strong> {latestStatus ?? "unknown"}</div>
        </div>
      ) : null}
      {message ? <div role="status">{message}</div> : null}
    </div>
  );
}
