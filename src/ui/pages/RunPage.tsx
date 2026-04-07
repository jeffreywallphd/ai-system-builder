import { useCallback, useEffect, useMemo, useState } from "react";
import ContextualRecommendationsPanel from "../components/navigation/ContextualRecommendationsPanel";
import RecentAndFavoritesPanel from "../components/navigation/RecentAndFavoritesPanel";
import { ContextualRecommendationService, ContextualRecommendationSurfaces } from "../routes/ContextualRecommendations";
import { RecentAndFavoritesService } from "../routes/RecentAndFavorites";
import { Link, useLocation } from "react-router-dom";
import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import ExecutionHistoryPanel from "../components/execution/ExecutionHistoryPanel";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { RunContextKinds, RunInterfaceService } from "../routes/RunInterface";
import { PersistedWorkflowEntryService, type PersistedWorkflowEntry } from "../routes/PersistedWorkflowEntryService";
import { RuntimeOperationsService } from "../services/RuntimeOperationsService";
import type { RuntimeQueueItem } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import {
  RuntimeRealtimeSubscriptionService,
  type RuntimeRealtimeConnectionStateSnapshot,
} from "@shared/runtime/RuntimeRealtimeSubscriptionService";

interface RunPageProps {
  readonly runtimeOperationsService?: RuntimeOperationsService;
  readonly runtimeRealtimeSubscriptionService?: RuntimeRealtimeSubscriptionService;
}

export default function RunPage(props: RunPageProps): JSX.Element {
  const location = useLocation();
  const { executionHistoryService } = useUiDependencies();
  const service = useMemo(() => new RunInterfaceService(), []);
  const persistedWorkflowEntryService = useMemo(() => new PersistedWorkflowEntryService(), []);
  const runtimeOperationsService = useMemo(
    () => props.runtimeOperationsService ?? new RuntimeOperationsService(),
    [props.runtimeOperationsService],
  );
  const runtimeRealtimeSubscriptionService = useMemo(
    () => props.runtimeRealtimeSubscriptionService ?? new RuntimeRealtimeSubscriptionService(),
    [props.runtimeRealtimeSubscriptionService],
  );
  const recommendationService = useMemo(() => new ContextualRecommendationService(), []);
  const recentAndFavoritesService = useMemo(() => new RecentAndFavoritesService(), []);
  const presentation = useMemo(() => service.resolvePresentation(location.search), [location.search, service]);
  const recommendations = recommendationService.resolve({
    surface: ContextualRecommendationSurfaces.run,
    runContextKind: presentation.request.contextKind,
    runOriginPath: presentation.request.originPath,
    assetActionContext: presentation.request.assetId
      ? {
          source: "detail",
          asset: {
            assetId: presentation.request.assetId,
            versionId: presentation.request.versionId,
            taxonomy: undefined,
          },
        }
      : undefined,
  });
  const recents = recentAndFavoritesService.listRecents(4);
  const favorites = recentAndFavoritesService.listFavorites();
  const [history, setHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);
  const [persistedWorkflows, setPersistedWorkflows] = useState<ReadonlyArray<PersistedWorkflowEntry>>([]);
  const [isPersistedWorkflowsLoading, setIsPersistedWorkflowsLoading] = useState(true);
  const [persistedWorkflowsError, setPersistedWorkflowsError] = useState<string | undefined>();
  const [runtimeQueueItems, setRuntimeQueueItems] = useState<ReadonlyArray<RuntimeQueueItem>>([]);
  const [runtimeQueueError, setRuntimeQueueError] = useState<string | undefined>();
  const [isRuntimeQueueLoading, setIsRuntimeQueueLoading] = useState(false);
  const [runtimeRealtimeConnectionState, setRuntimeRealtimeConnectionState] = useState<RuntimeRealtimeConnectionStateSnapshot>({
    state: "connecting",
    stale: false,
  });
  const [runtimeExecutionId, setRuntimeExecutionId] = useState("");
  const [runtimeExecutionState, setRuntimeExecutionState] = useState<{
    readonly executionId?: string;
    readonly status?: string;
    readonly progressLabel?: string;
    readonly diagnosticsCount?: number;
    readonly traceEventCount?: number;
    readonly traceLogCount?: number;
    readonly outputFieldCount?: number;
    readonly outputContractIds?: ReadonlyArray<string>;
  }>();
  const [runtimeExecutionError, setRuntimeExecutionError] = useState<string | undefined>();
  const [runtimeLaunchSystemId, setRuntimeLaunchSystemId] = useState("");
  const [runtimeLaunchVersionId, setRuntimeLaunchVersionId] = useState("");
  const [runtimeLaunchTrigger, setRuntimeLaunchTrigger] = useState<"manual" | "api">("manual");
  const [runtimeLaunchInputPayload, setRuntimeLaunchInputPayload] = useState("{\n  \"message\": \"Hello from thin-client run operations\"\n}");
  const [runtimeLaunchApprovedParameters, setRuntimeLaunchApprovedParameters] = useState("{\n  \"maxRuntimeSeconds\": 120,\n  \"maxOutputAssets\": 5\n}");
  const [runtimeLaunchError, setRuntimeLaunchError] = useState<string | undefined>();
  const [runtimeLaunchResult, setRuntimeLaunchResult] = useState<{
    readonly executionId: string;
    readonly status: string;
    readonly systemId: string;
    readonly versionId: string;
  }>();
  const [isRuntimeLaunchPending, setIsRuntimeLaunchPending] = useState(false);

  useEffect(() => {
    recentAndFavoritesService.recordRecentRunContext({ request: presentation.request, launchPath: presentation.launchPath });
    let active = true;
    void executionHistoryService
      .listHistory({ limit: 10 })
      .then((runs) => {
        if (active) {
          setHistory(runs);
        }
      })
      .catch(() => {
        if (active) {
          setHistory([]);
        }
      });
    return () => {
      active = false;
    };
  }, [executionHistoryService, presentation.launchPath, presentation.request, recentAndFavoritesService]);

  useEffect(() => {
    let active = true;
    setIsPersistedWorkflowsLoading(true);
    void persistedWorkflowEntryService.listEntries(6).then((response) => {
      if (!active) {
        return;
      }
      if (!response.ok || !response.data) {
        setPersistedWorkflows([]);
        setPersistedWorkflowsError(response.error ?? "Failed to load persisted workflows.");
        setIsPersistedWorkflowsLoading(false);
        return;
      }
      setPersistedWorkflows(response.data);
      setPersistedWorkflowsError(undefined);
      setIsPersistedWorkflowsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [persistedWorkflowEntryService]);

  const refreshRuntimeQueue = useCallback((): Promise<void> => {
    setIsRuntimeQueueLoading(true);
    return runtimeOperationsService.listQueueItems({ limit: 20, statuses: ["queued", "running"] }).then((response) => {
      if (!response.ok || !response.data) {
        setRuntimeQueueItems([]);
        setRuntimeQueueError(response.error?.message ?? "Failed to load runtime queue.");
        return;
      }
      setRuntimeQueueItems(response.data.items);
      setRuntimeQueueError(undefined);
    }).finally(() => {
      setIsRuntimeQueueLoading(false);
    });
  }, [runtimeOperationsService]);

  const inspectRuntimeExecution = useCallback(async (executionId: string): Promise<void> => {
    const summary = await runtimeOperationsService.inspectRun({
      executionId,
      diagnosticsLimit: 20,
      eventLimit: 20,
      logLimit: 20,
    });
    if (!summary.ok || !summary.data) {
      setRuntimeExecutionState(undefined);
      setRuntimeExecutionError(summary.error?.message ?? "Failed to load runtime status.");
      return;
    }

    setRuntimeExecutionState(Object.freeze({
      executionId: summary.data.executionId,
      status: summary.data.status,
      progressLabel: summary.data.progressLabel,
      diagnosticsCount: summary.data.diagnosticsCount,
      traceEventCount: summary.data.traceEventCount,
      traceLogCount: summary.data.traceLogCount,
      outputFieldCount: summary.data.outputFieldCount,
      outputContractIds: summary.data.outputContractIds,
    }));
    setRuntimeExecutionError(undefined);
  }, [runtimeOperationsService]);

  useEffect(() => {
    void refreshRuntimeQueue();
  }, [refreshRuntimeQueue]);

  useEffect(() => {
    const selectedExecutionId = runtimeExecutionId.trim() || runtimeExecutionState?.executionId;
    const subscription = runtimeRealtimeSubscriptionService.subscribeOperationalUpdates({
      executionId: selectedExecutionId,
      onQueueMovementEvent: () => {
        void refreshRuntimeQueue();
      },
      onRunStatusEvent: (payload) => {
        const selectedId = runtimeExecutionId.trim() || runtimeExecutionState?.executionId;
        if (!selectedId || selectedId !== payload.executionId) {
          return;
        }
        setRuntimeExecutionState((current) => Object.freeze({
          executionId: payload.executionId,
          status: payload.status,
          progressLabel: payload.progress
            ? `${payload.progress.completedNodeCount}/${payload.progress.totalNodeCount} nodes`
            : current?.progressLabel ?? "-",
          diagnosticsCount: current?.diagnosticsCount,
          traceEventCount: current?.traceEventCount,
          traceLogCount: current?.traceLogCount,
          outputFieldCount: current?.outputFieldCount,
          outputContractIds: current?.outputContractIds,
        }));
      },
      onRuntimeConnectivityEvent: (payload) => {
        setRuntimeRealtimeConnectionState((current) => Object.freeze({
          state: payload.state === "connected"
            ? "connected"
            : payload.state === "reconnecting"
              ? "reconnecting"
              : payload.state === "degraded"
                ? "degraded"
                : "disconnected",
          stale: payload.state !== "connected",
          detail: payload.reason ?? current.detail,
        }));
      },
      onConnectionStateChanged: (state) => {
        setRuntimeRealtimeConnectionState(state);
      },
      onError: (message) => {
        setRuntimeQueueError(message);
      },
      fallbackRefresh: async () => {
        await refreshRuntimeQueue();
        const currentExecutionId = runtimeExecutionId.trim() || runtimeExecutionState?.executionId;
        if (currentExecutionId) {
          await inspectRuntimeExecution(currentExecutionId);
        }
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [
    inspectRuntimeExecution,
    refreshRuntimeQueue,
    runtimeExecutionId,
    runtimeExecutionState?.executionId,
    runtimeRealtimeSubscriptionService,
  ]);

  const launchRuntimeExecution = async (): Promise<void> => {
    const normalizedSystemId = runtimeLaunchSystemId.trim();
    const normalizedVersionId = runtimeLaunchVersionId.trim();
    if (!normalizedSystemId || !normalizedVersionId) {
      setRuntimeLaunchError("System id and version id are required.");
      setRuntimeLaunchResult(undefined);
      return;
    }

    const parsedInputPayload = parseOptionalJson(runtimeLaunchInputPayload);
    if (!parsedInputPayload.ok) {
      setRuntimeLaunchError(parsedInputPayload.error);
      setRuntimeLaunchResult(undefined);
      return;
    }

    const parsedApprovedParameters = parseOptionalRecordJson(runtimeLaunchApprovedParameters);
    if (!parsedApprovedParameters.ok) {
      setRuntimeLaunchError(parsedApprovedParameters.error);
      setRuntimeLaunchResult(undefined);
      return;
    }

    setIsRuntimeLaunchPending(true);
    const response = await runtimeOperationsService.startRun({
      systemId: normalizedSystemId,
      versionId: normalizedVersionId,
      async: true,
      trigger: runtimeLaunchTrigger,
      inputPayload: parsedInputPayload.value,
      approvedParameters: parsedApprovedParameters.value,
    });
    setIsRuntimeLaunchPending(false);
    if (!response.ok || !response.data) {
      setRuntimeLaunchError(response.error?.message ?? "Failed to launch runtime execution.");
      setRuntimeLaunchResult(undefined);
      return;
    }

    setRuntimeLaunchError(undefined);
    setRuntimeLaunchResult(Object.freeze({
      executionId: response.data.executionId,
      status: response.data.status,
      systemId: response.data.systemId,
      versionId: response.data.versionId,
    }));
    setRuntimeExecutionId(response.data.executionId);
    await inspectRuntimeExecution(response.data.executionId);
    await refreshRuntimeQueue();
  };

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="run-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{presentation.shellTitle}</h1>
          <p className="ui-page__subtitle">{presentation.shellSubtitle}</p>
        </div>
      </div>

      <ContextualRecommendationsPanel recommendations={recommendations} />
      <RecentAndFavoritesPanel service={recentAndFavoritesService} recents={recents} favorites={favorites} />

      {presentation.request.contextKind === RunContextKinds.workflow && !presentation.request.workflowId ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <p role="alert">Run workflow context requires a valid workflow id. Select a saved workflow below.</p>
          </div>
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2 style={{ margin: 0 }}>{presentation.surface.title}</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>{presentation.surface.subtitle}</p>
          <span className="ui-badge">Context: {presentation.surface.contextLabel}</span>
          {presentation.request.originPath ? (
            <span className="ui-text-small ui-text-secondary">Origin: {presentation.request.originLabel ?? presentation.request.originPath}</span>
          ) : null}
          <div className="ui-row ui-row--wrap" style={{ gap: "0.75rem" }}>
            <Link className="ui-button ui-button--primary ui-button--sm" to={presentation.surface.primaryActionPath}>
              {presentation.surface.primaryActionLabel}
            </Link>
            <Link className="ui-button ui-button--ghost ui-button--small" to={ROUTE_PATHS.systemStudio}>Open system runner</Link>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2>Run a saved workflow</h2>
          <p className="ui-text-secondary">Select a persisted workflow from Run and continue in Workflow Studio.</p>
          {isPersistedWorkflowsLoading ? <p className="ui-text-secondary">Loading saved workflows...</p> : null}
          {!isPersistedWorkflowsLoading && persistedWorkflowsError ? <p role="alert">{persistedWorkflowsError}</p> : null}
          {!isPersistedWorkflowsLoading && !persistedWorkflowsError && persistedWorkflows.length === 0 ? (
            <p className="ui-text-secondary">No persisted workflows are available yet.</p>
          ) : null}
          {!isPersistedWorkflowsLoading && !persistedWorkflowsError && persistedWorkflows.length > 0 ? (
            <div className="ui-stack ui-stack--xs" data-testid="run-persisted-workflow-list">
              {persistedWorkflows.map((workflow) => (
                <article key={workflow.workflowId} className="ui-card ui-card--interactive">
                  <div className="ui-card__body ui-stack ui-stack--2xs">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong>{workflow.displayName}</strong>
                      <span className="ui-badge ui-badge--neutral">{workflow.status}</span>
                    </div>
                    <p className="ui-text-small ui-text-secondary">{workflow.workflowId}</p>
                    {workflow.summary ? <p className="ui-text-small ui-text-secondary">{workflow.summary}</p> : null}
                    <div className="ui-row ui-row--wrap">
                      <Link className="ui-button ui-button--primary ui-button--small" to={persistedWorkflowEntryService.buildRunWorkflowPath(workflow)}>
                        Run workflow
                      </Link>
                      <Link className="ui-button ui-button--ghost ui-button--small" to={persistedWorkflowEntryService.buildWorkflowStudioOpenPath(workflow)}>
                        Open in Workflow Studio
                      </Link>
                      <Link className="ui-button ui-button--ghost ui-button--small" to={persistedWorkflowEntryService.buildWorkflowRunHistoryPath(workflow)}>
                        View run history
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ui-card" data-testid="run-runtime-operations-panel">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2>Desktop and thin-client runtime operations</h2>
          <p className="ui-text-secondary">Queue review, allowed run launch, output inspection, and approved parameter adjustments through shared authoritative runtime APIs.</p>
          <div className="ui-stack ui-stack--xs">
            <h3 style={{ margin: 0 }}>Launch allowed run</h3>
            <div className="ui-row ui-row--wrap" style={{ gap: "0.75rem" }}>
              <label className="ui-field" style={{ minWidth: "18rem", flex: "1 1 18rem" }}>
                <span className="ui-field__label">System id</span>
                <input
                  className="ui-input"
                  value={runtimeLaunchSystemId}
                  onChange={(event) => setRuntimeLaunchSystemId(event.target.value)}
                  placeholder="system:demo"
                />
              </label>
              <label className="ui-field" style={{ minWidth: "18rem", flex: "1 1 18rem" }}>
                <span className="ui-field__label">Version id</span>
                <input
                  className="ui-input"
                  value={runtimeLaunchVersionId}
                  onChange={(event) => setRuntimeLaunchVersionId(event.target.value)}
                  placeholder="system:demo:v1"
                />
              </label>
              <label className="ui-field" style={{ minWidth: "10rem" }}>
                <span className="ui-field__label">Trigger</span>
                <select
                  className="ui-input"
                  value={runtimeLaunchTrigger}
                  onChange={(event) => setRuntimeLaunchTrigger(event.target.value === "api" ? "api" : "manual")}
                >
                  <option value="manual">manual</option>
                  <option value="api">api</option>
                </select>
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Approved parameters (JSON object)</span>
              <textarea
                className="ui-input"
                value={runtimeLaunchApprovedParameters}
                onChange={(event) => setRuntimeLaunchApprovedParameters(event.target.value)}
                rows={4}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Input payload (JSON)</span>
              <textarea
                className="ui-input"
                value={runtimeLaunchInputPayload}
                onChange={(event) => setRuntimeLaunchInputPayload(event.target.value)}
                rows={4}
              />
            </label>
            <div className="ui-row ui-row--wrap">
              <button className="ui-button ui-button--secondary ui-button--small" onClick={() => void launchRuntimeExecution()}>
                {isRuntimeLaunchPending ? "Launching..." : "Launch allowed run"}
              </button>
            </div>
            {runtimeLaunchError ? <p role="alert">{runtimeLaunchError}</p> : null}
            {runtimeLaunchResult ? (
              <p className="ui-text-small">
                Launched execution <strong>{runtimeLaunchResult.executionId}</strong> ({runtimeLaunchResult.status}) for {runtimeLaunchResult.systemId}@{runtimeLaunchResult.versionId}.
              </p>
            ) : null}
          </div>
          <h3 style={{ margin: 0 }}>Queue review and run controls</h3>
          <p className="ui-text-small ui-text-secondary">
            Realtime channel: <strong>{runtimeRealtimeConnectionState.state}</strong>
            {runtimeRealtimeConnectionState.stale ? " (stale data fallback active)" : ""}
            {runtimeRealtimeConnectionState.detail ? ` - ${runtimeRealtimeConnectionState.detail}` : ""}
          </p>
          <p className="ui-text-small ui-text-secondary">
            Thin-client lifecycle resume handling (tab focus, visibility restore, and network return) is applied through shared realtime subscription behavior.
          </p>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            <button className="ui-button ui-button--ghost ui-button--small" onClick={() => void refreshRuntimeQueue()}>
              {isRuntimeQueueLoading ? "Refreshing queue..." : "Refresh queue"}
            </button>
          </div>
          {runtimeQueueError ? <p role="alert">{runtimeQueueError}</p> : null}
          {runtimeQueueItems.length === 0 ? (
            <p className="ui-text-secondary">No queued or running executions are visible for this workspace.</p>
          ) : (
            <div className="ui-stack ui-stack--xs" data-testid="run-runtime-queue-list">
              {runtimeQueueItems.map((item) => (
                <article key={item.queueItemId} className="ui-card ui-card--interactive">
                  <div className="ui-card__body ui-stack ui-stack--2xs">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong>{item.executionId}</strong>
                      <span className="ui-badge ui-badge--neutral">{item.status}</span>
                    </div>
                    <p className="ui-text-small ui-text-secondary">{item.queueItemId}</p>
                    <p className="ui-text-small ui-text-secondary">System: {item.systemId}</p>
                    <div className="ui-row ui-row--wrap">
                      <button
                        className="ui-button ui-button--ghost ui-button--small"
                        onClick={() => {
                          setRuntimeExecutionId(item.executionId);
                          void inspectRuntimeExecution(item.executionId);
                        }}
                      >
                        Inspect run
                      </button>
                      <button
                        className="ui-button ui-button--ghost ui-button--small"
                        onClick={() => {
                          void runtimeOperationsService.cancelRun({
                            executionId: item.executionId,
                            reason: "User cancelled from thin-client operational panel.",
                          }).then((response) => {
                            if (!response.ok) {
                              setRuntimeQueueError(response.error?.message ?? "Failed to cancel runtime execution.");
                              return;
                            }
                            return refreshRuntimeQueue();
                          });
                        }}
                      >
                        Cancel run
                      </button>
                      <button
                        className="ui-button ui-button--ghost ui-button--small"
                        onClick={() => {
                          void runtimeOperationsService.dequeueQueueItem({
                            queueItemId: item.queueItemId,
                            reason: "User dequeued from thin-client operational panel.",
                          }).then((response) => {
                            if (!response.ok) {
                              setRuntimeQueueError(response.error?.message ?? "Failed to dequeue runtime item.");
                              return;
                            }
                            return refreshRuntimeQueue();
                          });
                        }}
                      >
                        Dequeue
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="ui-stack ui-stack--xs">
            <label className="ui-field">
              <span className="ui-field__label">Execution id</span>
              <input
                className="ui-input"
                value={runtimeExecutionId}
                onChange={(event) => setRuntimeExecutionId(event.target.value)}
                placeholder="execution-id"
              />
            </label>
            <div className="ui-row ui-row--wrap">
              <button
                className="ui-button ui-button--secondary ui-button--small"
                onClick={() => void inspectRuntimeExecution(runtimeExecutionId)}
              >
                Inspect execution
              </button>
            </div>
            {runtimeExecutionError ? <p role="alert">{runtimeExecutionError}</p> : null}
            {runtimeExecutionState ? (
              <div className="ui-stack ui-stack--2xs ui-text-small">
                <span>Execution id: {runtimeExecutionState.executionId ?? runtimeExecutionId}</span>
                <span>Status: {runtimeExecutionState.status}</span>
                <span>Progress: {runtimeExecutionState.progressLabel}</span>
                <span>Diagnostics: {runtimeExecutionState.diagnosticsCount ?? "-"}</span>
                <span>Trace events/logs: {runtimeExecutionState.traceEventCount ?? "-"} / {runtimeExecutionState.traceLogCount ?? "-"}</span>
                <span>Output fields: {runtimeExecutionState.outputFieldCount ?? "-"}</span>
                <span>Output contracts: {runtimeExecutionState.outputContractIds?.join(", ") || "-"}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ExecutionHistoryPanel
        title="Recent run activity"
        subtitle="Execution status and results are preserved in one shared run history surface."
        items={history}
        emptyMessage="No execution runs are available yet. Launch a run to populate history."
        executionHistoryService={executionHistoryService}
      />
    </section>
  );
}

function parseOptionalJson(raw: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string } {
  const normalized = raw.trim();
  if (!normalized) {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(normalized) };
  } catch {
    return { ok: false, error: "Input payload must be valid JSON." };
  }
}

function parseOptionalRecordJson(raw: string): { readonly ok: true; readonly value: Readonly<Record<string, unknown>> | undefined } | { readonly ok: false; readonly error: string } {
  const normalized = raw.trim();
  if (!normalized) {
    return { ok: true, value: undefined };
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Approved parameters must be a JSON object." };
    }
    return { ok: true, value: Object.freeze({ ...(parsed as Record<string, unknown>) }) };
  } catch {
    return { ok: false, error: "Approved parameters must be valid JSON." };
  }
}

