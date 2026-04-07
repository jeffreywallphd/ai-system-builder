import { useEffect, useMemo, useState } from "react";
import { AssetDraftLifecycleStatuses } from "@domain/studio-shell/StudioShellDomain";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { ExecutionMonitorPanel } from "./runtime/ExecutionMonitorPanel";
import { ExecutionResultPanel } from "./runtime/ExecutionResultPanel";
import { UxRuntimeService } from "../../runtime/UxRuntimeService";
import SystemRuntimeInterfacePreview from "./system/SystemRuntimeInterfacePreview";
import { workflowStudioSurfaceAssetDefinition } from "../../studio-shell/studio-assets/StudioSurfaceAssetDefinitions";
import { imageManipulationEditorPageAssetDefinition } from "../../studio-shell/studio-assets/ImageManipulationEditorPageAsset";
import { createImageManipulationRuntimeWindowLaunchRequest } from "@application/system-runtime/SystemRuntimeWindowLaunchResolver";
import { ImageManipulationSystemTemplate } from "@application/system-studio/ImageManipulationSystemTemplate";
import { SystemRuntimeWindowRestoreService } from "../../runtime/SystemRuntimeWindowRestoreService";

interface SystemRuntimeRunPanelProps {
  readonly context: StudioShellExtensionContext;
}

export function SystemRuntimeRunPanel({ context }: SystemRuntimeRunPanelProps): JSX.Element {
  const [message, setMessage] = useState<string | undefined>();
  const [latestExecutionId, setLatestExecutionId] = useState<string | undefined>();
  const [status, setStatus] = useState<Awaited<ReturnType<NonNullable<StudioShellExtensionContext["operations"]["getSystemExecutionStatus"]>>>["data"]>();
  const [trace, setTrace] = useState<Awaited<ReturnType<NonNullable<StudioShellExtensionContext["operations"]["getSystemExecutionTrace"]>>>["data"]>();
  const [result, setResult] = useState<Awaited<ReturnType<NonNullable<StudioShellExtensionContext["operations"]["getSystemExecutionResult"]>>>["data"]>();
  const uxRuntimeService = useMemo(() => new UxRuntimeService(), []);
  const runtimeWindowRestoreService = useMemo(() => new SystemRuntimeWindowRestoreService(), []);
  const [isRunning, setIsRunning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const runtimePanelStudioAssetHosts = useMemo(() => Object.freeze({
    [workflowStudioSurfaceAssetDefinition.contract.identity.studioType]: Object.freeze({
      asset: workflowStudioSurfaceAssetDefinition,
      resolveInput: ({ panel, extensionContext }: { readonly panel: { readonly content?: { readonly draftContent?: string; readonly embeddedVariant?: string; readonly experienceAssetIds?: ReadonlyArray<string> } }; readonly extensionContext: StudioShellExtensionContext }) => Object.freeze({
        content: panel.content?.draftContent ?? "",
        onChangeContent: () => undefined,
        isWorkflowStudio: true,
        experienceAssetIds: Array.isArray(panel.content?.experienceAssetIds)
          ? panel.content?.experienceAssetIds
          : Object.freeze(["loom-wizard"]),
        embeddedVariant: panel.content?.embeddedVariant === "behavior-automation" ? "behavior-automation" : undefined,
        workflowModeContext: undefined,
        extensionContext,
      }),
    }),
    [imageManipulationEditorPageAssetDefinition.contract.identity.studioType]: Object.freeze({
      asset: imageManipulationEditorPageAssetDefinition,
      resolveInput: ({ extensionContext }: { readonly extensionContext: StudioShellExtensionContext }) => Object.freeze({
        extensionContext,
      }),
    }),
  }), []);

  const draft = context.snapshot?.draft;
  const canRun = useMemo(() => {
    if (!draft) {
      return false;
    }
    return draft.lifecycleStatus === AssetDraftLifecycleStatuses.validated
      || draft.lifecycleStatus === AssetDraftLifecycleStatuses.published;
  }, [draft]);
  const canLaunchRuntimeWindow = useMemo(() => {
    return Boolean(
      draft?.draftId
      && draft.assetId === ImageManipulationSystemTemplate.systemAsset.assetId
      && context.operations.launchRuntimeWindow,
    );
  }, [context.operations.launchRuntimeWindow, draft?.assetId, draft?.draftId]);

  const isTerminal = status?.status === "succeeded" || status?.status === "failed" || status?.status === "cancelled";

  const refreshExecutionDetails = async (executionId: string): Promise<void> => {
    setIsRefreshing(true);
    try {
      const snapshot = await uxRuntimeService.readSystemRunSnapshot(executionId, context.operations);
      if (!snapshot.ok || !snapshot.data) {
        setMessage(snapshot.message ?? "Unable to refresh execution status.");
        return;
      }

      setStatus(snapshot.data.raw.status);
      setTrace(snapshot.data.raw.trace);
      setResult(snapshot.data.raw.result);
      setMessage(undefined);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!latestExecutionId || !autoRefreshEnabled || !status || isTerminal) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshExecutionDetails(latestExecutionId);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, isTerminal, latestExecutionId, status]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-runtime-run-panel">
      <p className="ui-text-muted">
        Trigger bounded runtime execution for the current System Studio draft and monitor runtime progression/results through the real backend API path.
      </p>
      <SystemRuntimeInterfacePreview
        content={draft?.content ?? ""}
        extensionContext={context}
        studioAssetHosts={runtimePanelStudioAssetHosts}
      />
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
            void uxRuntimeService.launchSystemRun({
              studioId: context.studioId,
              draftId: draft.draftId,
              context: {
                trigger: "manual",
                actorId: "system-studio-ui",
              },
            }, context.operations).then(async (response) => {
              if (!response.ok || !response.data) {
                setMessage(response.error?.message ?? "Runtime execution failed to start.");
                return;
              }

              setLatestExecutionId(response.data.executionId);
              setStatus(undefined);
              setTrace(undefined);
              setResult(undefined);
              setMessage(`Started execution '${response.data.executionId}' with status '${response.data.status}'.`);
              await refreshExecutionDetails(response.data.executionId);
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
      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="ui-button"
          disabled={!latestExecutionId || isRefreshing}
          onClick={() => {
            if (!latestExecutionId) {
              return;
            }
            void refreshExecutionDetails(latestExecutionId);
          }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Monitoring"}
        </button>
        <label className="ui-text-small ui-text-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={(event) => setAutoRefreshEnabled(event.currentTarget.checked)}
          />
          Auto-refresh every 2s (while running)
        </label>
        <button
          className="ui-button ui-button--ghost"
          disabled={!canLaunchRuntimeWindow || isRunning}
          onClick={() => {
            if (!draft?.draftId || !context.operations.launchRuntimeWindow) {
              return;
            }
            const launchRequest = createImageManipulationRuntimeWindowLaunchRequest({
                studioId: context.studioId,
                draftId: draft.draftId,
                sessionId: context.snapshot?.activeSessionId,
                systemAssetId: draft.assetId,
              });
            const reopenAwareRequest = runtimeWindowRestoreService.buildReopenRequest(launchRequest);
            const responsePromise = context.operations.launchRuntimeWindow(reopenAwareRequest);
            void responsePromise.then((response) => {
              if (!response.ok || !response.data) {
                setMessage(response.error?.message ?? "Could not open the runtime window.");
                return;
              }
              setMessage(`Opened runtime window '${response.data.launchId}'.`);
            });
          }}
        >
          Open Runtime Window
        </button>
      </div>
      {latestExecutionId ? (
        <div className="ui-stack ui-stack--2xs">
          <div><strong>Execution:</strong> {latestExecutionId}</div>
          <div><strong>Status:</strong> {status?.status ?? "unknown"}</div>
        </div>
      ) : null}
      {message ? <div role="status">{message}</div> : null}
      <ExecutionMonitorPanel status={status} trace={trace} />
      <ExecutionResultPanel result={result} />
    </div>
  );
}

