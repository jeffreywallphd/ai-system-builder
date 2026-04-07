import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import type { RuntimeQueueItem } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import type { NodeInventorySummaryDto } from "@shared/contracts/nodes/NodeTrustApiContracts";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@shared/identity/IdentityAuthSessionStore";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import {
  RuntimeRealtimeSubscriptionService,
  type RuntimeRealtimeConnectionStateSnapshot,
} from "@shared/runtime/RuntimeRealtimeSubscriptionService";
import { useUiDependencies } from "../composition/AppProviders";
import { RuntimeOperationsService } from "../services/RuntimeOperationsService";
import { NodeInventoryService } from "../services/NodeInventoryService";
import {
  ContextualRecommendationService,
  ContextualRecommendationSurfaces,
} from "../routes/ContextualRecommendations";
import { RecentAndFavoritesService } from "../routes/RecentAndFavorites";
import { RunContextKinds, RunInterfaceService } from "../routes/RunInterface";
import ContextualRecommendationsPanel from "../components/navigation/ContextualRecommendationsPanel";
import RecentAndFavoritesPanel from "../components/navigation/RecentAndFavoritesPanel";
import {
  buildOperationalWorkspaceDashboardModel,
  type OperationalWorkspaceRecentOutputSummary,
} from "../presenters/OperationalWorkspaceDashboardPresenter";
import { OperationalWorkspaceDashboard } from "../shared/operations";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import RunDesktopOperationalDashboardPage from "./RunDesktopOperationalDashboardPage";
import RunThinClientOperationalDashboardPage from "./RunThinClientOperationalDashboardPage";
import { useSurfaceResponsiveProfile } from "../shared/responsive";
import { SurfaceStatePanel } from "../shared/components/presentation-state";
import { resolveIdentityAccessChannel } from "../shared/identity/IdentityAuthEnvironment";

interface RunPageProps {
  readonly runtimeOperationsService?: RuntimeOperationsService;
  readonly runtimeRealtimeSubscriptionService?: RuntimeRealtimeSubscriptionService;
  readonly nodeInventoryService?: NodeInventoryService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function RunPage(props: RunPageProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { executionHistoryService } = useUiDependencies();

  const runInterfaceService = useMemo(() => new RunInterfaceService(), []);
  const recommendationService = useMemo(() => new ContextualRecommendationService(), []);
  const recentAndFavoritesService = useMemo(() => new RecentAndFavoritesService(), []);
  const runtimeOperationsService = useMemo(
    () => props.runtimeOperationsService ?? new RuntimeOperationsService(),
    [props.runtimeOperationsService],
  );
  const runtimeRealtimeSubscriptionService = useMemo(
    () => props.runtimeRealtimeSubscriptionService ?? new RuntimeRealtimeSubscriptionService(),
    [props.runtimeRealtimeSubscriptionService],
  );
  const nodeInventoryService = useMemo(
    () => props.nodeInventoryService ?? new NodeInventoryService(),
    [props.nodeInventoryService],
  );
  const sessionStore = useMemo(
    () => props.sessionStore ?? new IdentityAuthSessionStore(),
    [props.sessionStore],
  );

  const session = useMemo(() => sessionStore.getSession(), [sessionStore]);
  const sessionToken = session?.sessionToken;
  const accessChannel = session?.sessionAccessChannel === "desktop"
    ? "desktop"
    : resolveIdentityAccessChannel();
  const isDesktopSurface = accessChannel === "desktop";

  const responsiveProfile = useSurfaceResponsiveProfile({
    preferDesktopComfortableDensity: !isDesktopSurface,
  });

  const presentation = useMemo(
    () => runInterfaceService.resolvePresentation(location.search),
    [location.search, runInterfaceService],
  );
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
  const [runtimeQueueItems, setRuntimeQueueItems] = useState<ReadonlyArray<RuntimeQueueItem>>([]);
  const [nodeInventory, setNodeInventory] = useState<ReadonlyArray<NodeInventorySummaryDto>>([]);
  const [recentOutputs, setRecentOutputs] = useState<ReadonlyArray<OperationalWorkspaceRecentOutputSummary>>([]);

  const [historyError, setHistoryError] = useState<string | undefined>();
  const [runtimeQueueError, setRuntimeQueueError] = useState<string | undefined>();
  const [nodeInventoryError, setNodeInventoryError] = useState<string | undefined>();
  const [recentOutputsError, setRecentOutputsError] = useState<string | undefined>();

  const [isRuntimeQueueLoading, setIsRuntimeQueueLoading] = useState(false);
  const [isRecentOutputsLoading, setIsRecentOutputsLoading] = useState(false);

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
  const [runtimeLaunchInputPayload, setRuntimeLaunchInputPayload] = useState("{\n  \"message\": \"Hello from operational dashboard\"\n}");
  const [runtimeLaunchApprovedParameters, setRuntimeLaunchApprovedParameters] = useState("{\n  \"maxRuntimeSeconds\": 120,\n  \"maxOutputAssets\": 5\n}");
  const [runtimeLaunchError, setRuntimeLaunchError] = useState<string | undefined>();
  const [runtimeLaunchResult, setRuntimeLaunchResult] = useState<{
    readonly executionId: string;
    readonly status: string;
    readonly systemId: string;
    readonly versionId: string;
  }>();
  const [isRuntimeLaunchPending, setIsRuntimeLaunchPending] = useState(false);

  const refreshRuntimeQueue = useCallback(async (): Promise<void> => {
    setIsRuntimeQueueLoading(true);
    const response = await runtimeOperationsService.listQueueItems({
      limit: 20,
      statuses: ["queued", "running"],
    });
    if (!response.ok || !response.data) {
      setRuntimeQueueItems([]);
      setRuntimeQueueError(response.error?.message ?? "Failed to load runtime queue.");
      setIsRuntimeQueueLoading(false);
      return;
    }

    setRuntimeQueueItems(response.data.items);
    setRuntimeQueueError(undefined);
    setIsRuntimeQueueLoading(false);
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

  const refreshNodeAvailability = useCallback(async (): Promise<void> => {
    if (!sessionToken) {
      setNodeInventory([]);
      setNodeInventoryError("An authenticated workspace session is required to load node availability.");
      return;
    }

    const response = await nodeInventoryService.listNodeInventory({ limit: 200 }, sessionToken);
    if (!response.ok || !response.data) {
      setNodeInventory([]);
      setNodeInventoryError(response.error?.message ?? "Failed to load node inventory summary.");
      return;
    }

    setNodeInventory(response.data.nodes);
    setNodeInventoryError(undefined);
  }, [nodeInventoryService, sessionToken]);

  const loadRecentOutputs = useCallback(async (): Promise<void> => {
    const candidateExecutionIds = [...new Set([
      ...runtimeQueueItems.map((item) => item.executionId),
      ...history.map((run) => run.runId),
    ])].slice(0, 8);

    if (candidateExecutionIds.length < 1) {
      setRecentOutputs([]);
      setRecentOutputsError(undefined);
      return;
    }

    setIsRecentOutputsLoading(true);
    const inspections = await Promise.all(candidateExecutionIds.map(async (executionId) => {
      const response = await runtimeOperationsService.inspectRun({ executionId, diagnosticsLimit: 5, eventLimit: 5, logLimit: 5 });
      if (!response.ok || !response.data) {
        return undefined;
      }
      const outputFieldCount = response.data.outputFieldCount ?? 0;
      const outputContractIds = response.data.outputContractIds ?? [];
      if (outputFieldCount < 1 && outputContractIds.length < 1) {
        return undefined;
      }
      return Object.freeze({
        executionId: response.data.executionId,
        status: response.data.status,
        outputFieldCount,
        outputContractIds,
      } satisfies OperationalWorkspaceRecentOutputSummary);
    }));

    const resolved = inspections.filter((entry): entry is OperationalWorkspaceRecentOutputSummary => Boolean(entry));
    setRecentOutputs(Object.freeze(resolved));
    setRecentOutputsError(undefined);
    setIsRecentOutputsLoading(false);
  }, [history, runtimeOperationsService, runtimeQueueItems]);

  const loadHistory = useCallback(async (): Promise<void> => {
    try {
      const runs = await executionHistoryService.listHistory({ limit: 8 });
      setHistory(runs);
      setHistoryError(undefined);
    } catch {
      setHistory([]);
      setHistoryError("Failed to load recent execution history.");
    }
  }, [executionHistoryService]);

  useEffect(() => {
    recentAndFavoritesService.recordRecentRunContext({
      request: presentation.request,
      launchPath: presentation.launchPath,
    });
  }, [presentation.launchPath, presentation.request, recentAndFavoritesService]);

  useEffect(() => {
    void loadHistory();
    void refreshRuntimeQueue();
    void refreshNodeAvailability();
  }, [loadHistory, refreshNodeAvailability, refreshRuntimeQueue]);

  useEffect(() => {
    void loadRecentOutputs().catch(() => {
      setRecentOutputs([]);
      setRecentOutputsError("Recent output inspection is currently unavailable.");
      setIsRecentOutputsLoading(false);
    });
  }, [loadRecentOutputs]);

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

  const launchRuntimeExecution = useCallback(async (): Promise<void> => {
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
    await loadHistory();
  }, [
    inspectRuntimeExecution,
    loadHistory,
    refreshRuntimeQueue,
    runtimeLaunchApprovedParameters,
    runtimeLaunchInputPayload,
    runtimeLaunchSystemId,
    runtimeLaunchTrigger,
    runtimeLaunchVersionId,
    runtimeOperationsService,
  ]);

  const dashboardModel = useMemo(() => buildOperationalWorkspaceDashboardModel({
    queueItems: runtimeQueueItems,
    recentRuns: history,
    recentOutputs,
    nodeInventory,
    realtime: runtimeRealtimeConnectionState,
  }), [history, nodeInventory, recentOutputs, runtimeQueueItems, runtimeRealtimeConnectionState]);

  if (!session || !sessionToken || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Operational workspace dashboard",
            message: "Sign in with an authenticated workspace session before using runtime operations and operational monitoring.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  const notices = [
    runtimeQueueError
      ? {
        tone: "danger" as const,
        content: <p>{runtimeQueueError}</p>,
      }
      : undefined,
    nodeInventoryError
      ? {
        tone: "warning" as const,
        content: <p>{nodeInventoryError}</p>,
      }
      : undefined,
    historyError
      ? {
        tone: "warning" as const,
        content: <p>{historyError}</p>,
      }
      : undefined,
  ].filter((notice): notice is { readonly tone: "neutral" | "success" | "warning" | "danger"; readonly content: JSX.Element } => Boolean(notice));

  const navigation = (
    <div className="ui-stack ui-stack--sm">
      <ContextualRecommendationsPanel recommendations={recommendations} />
      <RecentAndFavoritesPanel service={recentAndFavoritesService} recents={recents} favorites={favorites} />
      {presentation.request.contextKind === RunContextKinds.workflow && !presentation.request.workflowId ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <p role="alert">Run workflow context requires a valid workflow id. Select a saved workflow from Build or Workflow Studio.</p>
          </div>
        </div>
      ) : null}
    </div>
  );

  const content = (
    <OperationalWorkspaceDashboard
      model={dashboardModel}
      queueItems={runtimeQueueItems}
      recentRuns={history}
      recentOutputs={recentOutputs}
      isQueueLoading={isRuntimeQueueLoading}
      isRecentOutputsLoading={isRecentOutputsLoading}
      queueError={runtimeQueueError}
      recentOutputsError={recentOutputsError}
      responsiveProfile={responsiveProfile}
      onRefreshQueue={() => {
        void refreshRuntimeQueue();
      }}
      onInspectRun={(executionId) => {
        setRuntimeExecutionId(executionId);
        void inspectRuntimeExecution(executionId);
      }}
      onCancelRun={(executionId) => {
        void runtimeOperationsService.cancelRun({
          executionId,
          reason: "Cancelled from operational workspace dashboard.",
        }).then((response) => {
          if (!response.ok) {
            setRuntimeQueueError(response.error?.message ?? "Failed to cancel runtime execution.");
            return;
          }
          return refreshRuntimeQueue();
        });
      }}
      onDequeue={(queueItemId) => {
        void runtimeOperationsService.dequeueQueueItem({
          queueItemId,
          reason: "Dequeued from operational workspace dashboard.",
        }).then((response) => {
          if (!response.ok) {
            setRuntimeQueueError(response.error?.message ?? "Failed to dequeue runtime item.");
            return;
          }
          return refreshRuntimeQueue();
        });
      }}
      onOpenNodeInventory={() => {
        navigate(ROUTE_PATHS.nodeInventory);
      }}
    />
  );

  const detail = (
    <div className="ui-stack ui-stack--sm" data-testid="run-dashboard-controls">
      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Approved run initiation</h2>
          <p className="ui-card__subtitle">Launch approved runtime executions for the active workspace using authoritative runtime contracts.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <label className="ui-field">
            <span className="ui-field__label">System id</span>
            <input className="ui-input" value={runtimeLaunchSystemId} onChange={(event) => setRuntimeLaunchSystemId(event.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Version id</span>
            <input className="ui-input" value={runtimeLaunchVersionId} onChange={(event) => setRuntimeLaunchVersionId(event.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Trigger</span>
            <select
              className="ui-select"
              value={runtimeLaunchTrigger}
              onChange={(event) => setRuntimeLaunchTrigger(event.target.value === "api" ? "api" : "manual")}
            >
              <option value="manual">manual</option>
              <option value="api">api</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Approved parameters (JSON object)</span>
            <textarea className="ui-input" rows={4} value={runtimeLaunchApprovedParameters} onChange={(event) => setRuntimeLaunchApprovedParameters(event.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Input payload (JSON)</span>
            <textarea className="ui-input" rows={4} value={runtimeLaunchInputPayload} onChange={(event) => setRuntimeLaunchInputPayload(event.target.value)} />
          </label>
          <div className="ui-page__actions">
            <button type="button" className="ui-button ui-button--secondary ui-button--small" onClick={() => void launchRuntimeExecution()}>
              {isRuntimeLaunchPending ? "Launching..." : "Launch allowed run"}
            </button>
            <Link className="ui-button ui-button--ghost ui-button--small" to={ROUTE_PATHS.systemStudio}>Open system runner</Link>
          </div>
          {runtimeLaunchError ? <p role="alert">{runtimeLaunchError}</p> : null}
          {runtimeLaunchResult ? (
            <p className="ui-text-small">
              Launched <strong>{runtimeLaunchResult.executionId}</strong> ({runtimeLaunchResult.status}) from {runtimeLaunchResult.systemId}@{runtimeLaunchResult.versionId}.
            </p>
          ) : null}
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Run oversight</h2>
          <p className="ui-card__subtitle">Inspect run status, progress, diagnostics, trace, and output contract summary.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <label className="ui-field">
            <span className="ui-field__label">Execution id</span>
            <input className="ui-input" value={runtimeExecutionId} onChange={(event) => setRuntimeExecutionId(event.target.value)} />
          </label>
          <div className="ui-page__actions">
            <button type="button" className="ui-button ui-button--secondary ui-button--small" onClick={() => void inspectRuntimeExecution(runtimeExecutionId)}>
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
      </section>
    </div>
  );

  if (isDesktopSurface) {
    return (
      <RunDesktopOperationalDashboardPage
        notices={notices}
        navigation={navigation}
        content={content}
        detail={detail}
      />
    );
  }

  return (
    <RunThinClientOperationalDashboardPage
      notices={notices}
      navigation={navigation}
      content={content}
      detail={detail}
    />
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
