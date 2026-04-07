import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ExecutionRunDetailProjection } from "@application/execution/ExecutionRunDetailProjectionService";
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
import { AssetWorkflowService } from "../services/AssetWorkflowService";
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
import {
  OperationalApprovedRunLaunchPanel,
  OperationalRealtimeBanner,
  OperationalResultReviewPanels,
  OperationalQueueDetailPanel,
  OperationalQueueVisibilityPanel,
  OperationalRunDetailStatusPanel,
  OperationalRunListPanel,
  OperationalWorkspaceDashboard,
  QueueVisibilityScopes,
  resolveQueueVisibilityStatuses,
  type OperationalQueueFilters,
} from "../shared/operations";
import type { OperationalApprovedRunLaunchValidatedInput } from "../shared/operations";
import type { OperationalProtectedAssetActionState, OperationalResultReviewEntry } from "../shared/operations";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import RunDesktopOperationalDashboardPage from "./RunDesktopOperationalDashboardPage";
import RunThinClientOperationalDashboardPage from "./RunThinClientOperationalDashboardPage";
import { useSurfaceResponsiveProfile } from "../shared/responsive";
import { SurfaceStatePanel } from "../shared/components/presentation-state";
import { resolveIdentityAccessChannel } from "../shared/identity/IdentityAuthEnvironment";
import { toUserFacingAssetWorkflowError } from "@shared/assets/AssetWorkflowClient";
import type { AssetDetailDto } from "@shared/contracts/assets/AssetTransportContracts";

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
  const assetWorkflowService = useMemo(
    () => new AssetWorkflowService(),
    [],
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
  const workspaceId = session?.workspaceContext?.resolvedWorkspaceId
    ?? session?.workspaceContext?.requestedWorkspaceId
    ?? session?.initialCapabilityState?.workspaceId;
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
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<string | undefined>();
  const [queueFilters, setQueueFilters] = useState<OperationalQueueFilters>(Object.freeze({
    visibilityScope: QueueVisibilityScopes.active,
    systemIdFilter: "",
    queryFilter: "",
  }));
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
  const [realtimeReconnectRequestId, setRealtimeReconnectRequestId] = useState(0);

  const [runtimeExecutionId, setRuntimeExecutionId] = useState("");
  const [runtimeExecutionState, setRuntimeExecutionState] = useState<{
    readonly executionId?: string;
    readonly status?: string;
    readonly rootAssetId?: string;
    readonly rootVersionId?: string;
    readonly progressLabel?: string;
    readonly diagnosticsCount?: number;
    readonly traceEventCount?: number;
    readonly traceLogCount?: number;
    readonly outputFieldCount?: number;
    readonly outputContractIds?: ReadonlyArray<string>;
    readonly outputAssetIds?: ReadonlyArray<string>;
  }>();
  const [selectedRunDetail, setSelectedRunDetail] = useState<ExecutionRunDetailProjection | undefined>();
  const [isRunDetailLoading, setIsRunDetailLoading] = useState(false);
  const [runtimeExecutionError, setRuntimeExecutionError] = useState<string | undefined>();
  const [selectedResultExecutionId, setSelectedResultExecutionId] = useState<string | undefined>();
  const [assetDetailByExecutionAndAssetId, setAssetDetailByExecutionAndAssetId] = useState<Readonly<Record<string, Readonly<Record<string, AssetDetailDto | undefined>>>>(Object.freeze({}));
  const [assetActionStateByExecutionAndAssetId, setAssetActionStateByExecutionAndAssetId] = useState<Readonly<Record<string, Readonly<Record<string, OperationalProtectedAssetActionState | undefined>>>>(Object.freeze({}));

  const refreshRuntimeQueue = useCallback(async (): Promise<void> => {
    setIsRuntimeQueueLoading(true);
    const statusFilters = resolveQueueVisibilityStatuses(queueFilters.visibilityScope);
    const normalizedSystemId = queueFilters.systemIdFilter.trim() || undefined;
    const normalizedQuery = queueFilters.queryFilter.trim().toLowerCase();
    const response = await runtimeOperationsService.listQueueItems({
      limit: 50,
      statuses: statusFilters,
      systemId: normalizedSystemId,
    });
    if (!response.ok || !response.data) {
      setRuntimeQueueItems([]);
      setRuntimeQueueError(response.error?.message ?? "Failed to load runtime queue.");
      setIsRuntimeQueueLoading(false);
      return;
    }

    const visibleItems = normalizedQuery.length > 0
      ? response.data.items.filter((item) => (
        item.executionId.toLowerCase().includes(normalizedQuery)
        || item.queueItemId.toLowerCase().includes(normalizedQuery)
      ))
      : response.data.items;

    setRuntimeQueueItems(visibleItems);
    setRuntimeQueueError(undefined);
    setIsRuntimeQueueLoading(false);
  }, [queueFilters.queryFilter, queueFilters.systemIdFilter, queueFilters.visibilityScope, runtimeOperationsService]);

  const inspectRuntimeExecution = useCallback(async (executionId: string): Promise<void> => {
    const normalizedExecutionId = executionId.trim();
    if (!normalizedExecutionId) {
      setRuntimeExecutionState(undefined);
      setSelectedRunDetail(undefined);
      setRuntimeExecutionError("Execution id is required.");
      return;
    }

    setIsRunDetailLoading(true);
    const summary = await runtimeOperationsService.inspectRun({
      executionId: normalizedExecutionId,
      diagnosticsLimit: 20,
      eventLimit: 20,
      logLimit: 20,
    });

    if (!summary.ok || !summary.data) {
      setRuntimeExecutionState(undefined);
      setSelectedRunDetail(undefined);
      setRuntimeExecutionError(summary.error?.message ?? "Failed to load runtime status.");
      setIsRunDetailLoading(false);
      return;
    }

    const detail = await executionHistoryService.getRunDetail(normalizedExecutionId).catch(() => undefined);
    setSelectedRunDetail(detail);
    setRuntimeExecutionState(Object.freeze({
      executionId: summary.data.executionId,
      status: summary.data.status,
      rootAssetId: summary.data.rootAssetId,
      rootVersionId: summary.data.rootVersionId,
      progressLabel: summary.data.progressLabel,
      diagnosticsCount: summary.data.diagnosticsCount,
      traceEventCount: summary.data.traceEventCount,
      traceLogCount: summary.data.traceLogCount,
      outputFieldCount: summary.data.outputFieldCount,
      outputContractIds: summary.data.outputContractIds,
      outputAssetIds: summary.data.outputAssetIds,
    }));
    setSelectedResultExecutionId(summary.data.executionId);
    setRuntimeExecutionError(undefined);
    setIsRunDetailLoading(false);
  }, [executionHistoryService, runtimeOperationsService]);

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
        rootAssetId: response.data.rootAssetId,
        rootVersionId: response.data.rootVersionId,
        outputFieldCount,
        outputContractIds,
        outputAssetIds: response.data.outputAssetIds ?? Object.freeze([]),
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

  const requestRealtimeReconnect = useCallback((): void => {
    setRuntimeRealtimeConnectionState(() => Object.freeze({
      state: "connecting",
      stale: true,
      detail: "Manual reconnect requested. Re-establishing live runtime channel.",
    }));
    setRealtimeReconnectRequestId((current) => current + 1);
  }, []);

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
    if (!selectedQueueItemId) {
      return;
    }
    if (!runtimeQueueItems.some((item) => item.queueItemId === selectedQueueItemId)) {
      setSelectedQueueItemId(undefined);
    }
  }, [runtimeQueueItems, selectedQueueItemId]);

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
          rootAssetId: current?.rootAssetId,
          rootVersionId: current?.rootVersionId,
          progressLabel: payload.progress
            ? `${payload.progress.completedNodeCount}/${payload.progress.totalNodeCount} nodes`
            : current?.progressLabel ?? "-",
          diagnosticsCount: current?.diagnosticsCount,
          traceEventCount: current?.traceEventCount,
          traceLogCount: current?.traceLogCount,
          outputFieldCount: current?.outputFieldCount,
          outputContractIds: current?.outputContractIds,
          outputAssetIds: current?.outputAssetIds,
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
    realtimeReconnectRequestId,
    refreshRuntimeQueue,
    runtimeExecutionId,
    runtimeExecutionState?.executionId,
    runtimeRealtimeSubscriptionService,
  ]);

  const launchApprovedRun = useCallback(async (input: OperationalApprovedRunLaunchValidatedInput) => runtimeOperationsService.startRun({
    systemId: input.systemId,
    versionId: input.versionId,
    async: true,
    trigger: input.trigger,
    inputPayload: input.inputPayload,
    approvedParameters: input.approvedParameters,
  }), [runtimeOperationsService]);

  const dashboardModel = useMemo(() => buildOperationalWorkspaceDashboardModel({
    queueItems: runtimeQueueItems,
    recentRuns: history,
    recentOutputs,
    nodeInventory,
    realtime: runtimeRealtimeConnectionState,
  }), [history, nodeInventory, recentOutputs, runtimeQueueItems, runtimeRealtimeConnectionState]);

  const resultReviewEntries = useMemo(() => {
    const byExecutionId = new Map<string, OperationalResultReviewEntry>();
    for (const output of recentOutputs) {
      byExecutionId.set(output.executionId, Object.freeze({
        executionId: output.executionId,
        status: output.status,
        rootAssetId: output.rootAssetId,
        rootVersionId: output.rootVersionId,
        outputFieldCount: output.outputFieldCount,
        outputContractIds: output.outputContractIds,
        outputAssetIds: output.outputAssetIds ?? Object.freeze([]),
      }));
    }
    if (runtimeExecutionState?.executionId) {
      byExecutionId.set(runtimeExecutionState.executionId, Object.freeze({
        executionId: runtimeExecutionState.executionId,
        status: runtimeExecutionState.status,
        rootAssetId: runtimeExecutionState.rootAssetId,
        rootVersionId: runtimeExecutionState.rootVersionId,
        outputFieldCount: runtimeExecutionState.outputFieldCount ?? 0,
        outputContractIds: runtimeExecutionState.outputContractIds ?? Object.freeze([]),
        outputAssetIds: runtimeExecutionState.outputAssetIds ?? Object.freeze([]),
      }));
    }
    return Object.freeze([...byExecutionId.values()]);
  }, [recentOutputs, runtimeExecutionState]);

  const normalizedRuntimeExecutionId = runtimeExecutionId.trim() || undefined;
  const activeResultExecutionId = selectedResultExecutionId
    ?? normalizedRuntimeExecutionId
    ?? runtimeExecutionState?.executionId
    ?? resultReviewEntries[0]?.executionId;

  useEffect(() => {
    if (!selectedResultExecutionId) {
      return;
    }
    if (!resultReviewEntries.some((entry) => entry.executionId === selectedResultExecutionId)) {
      setSelectedResultExecutionId(undefined);
    }
  }, [resultReviewEntries, selectedResultExecutionId]);

  const setAssetDetailForRun = useCallback((executionId: string, assetId: string, detail: AssetDetailDto | undefined): void => {
    setAssetDetailByExecutionAndAssetId((current) => {
      const runEntries = {
        ...(current[executionId] ?? Object.freeze({})),
        [assetId]: detail,
      };
      return Object.freeze({
        ...current,
        [executionId]: Object.freeze(runEntries),
      });
    });
  }, []);

  const setAssetActionStateForRun = useCallback((executionId: string, assetId: string, next: OperationalProtectedAssetActionState): void => {
    setAssetActionStateByExecutionAndAssetId((current) => {
      const runEntries = {
        ...(current[executionId] ?? Object.freeze({})),
        [assetId]: next,
      };
      return Object.freeze({
        ...current,
        [executionId]: Object.freeze(runEntries),
      });
    });
  }, []);

  const ensureAssetDetail = useCallback(async (
    executionId: string,
    assetId: string,
  ): Promise<AssetDetailDto | undefined> => {
    const existing = assetDetailByExecutionAndAssetId[executionId]?.[assetId];
    if (existing) {
      return existing;
    }
    if (!sessionToken || !workspaceId) {
      return undefined;
    }
    const response = await assetWorkflowService.getAssetDetail({
      workspaceId,
      assetId,
    }, sessionToken);
    if (!response.ok || !response.data) {
      return undefined;
    }
    setAssetDetailForRun(executionId, assetId, response.data.asset);
    return response.data.asset;
  }, [assetDetailByExecutionAndAssetId, assetWorkflowService, sessionToken, setAssetDetailForRun, workspaceId]);

  const requestProtectedPreview = useCallback(async (executionId: string, assetId: string): Promise<void> => {
    if (!sessionToken || !workspaceId) {
      return;
    }
    const currentState = assetActionStateByExecutionAndAssetId[executionId]?.[assetId];
    setAssetActionStateForRun(executionId, assetId, Object.freeze({
      previewStatus: "loading",
      previewMessage: undefined,
      previewPath: undefined,
      downloadStatus: currentState?.downloadStatus ?? "idle",
      downloadMessage: currentState?.downloadMessage,
      downloadPath: currentState?.downloadPath,
    }));
    const detail = await ensureAssetDetail(executionId, assetId);
    if (detail?.allowedActions && !detail.allowedActions.canResolvePreview) {
      setAssetActionStateForRun(executionId, assetId, Object.freeze({
        previewStatus: "restricted",
        previewMessage: "Preview is restricted for this asset by authorization policy.",
        previewPath: undefined,
        downloadStatus: currentState?.downloadStatus ?? "idle",
        downloadMessage: currentState?.downloadMessage,
        downloadPath: currentState?.downloadPath,
      }));
      return;
    }

    const previewResolution = await assetWorkflowService.resolvePreview({
      workspaceId,
      assetId,
      preferredMimeTypes: ["image/webp", "image/png", "image/jpeg", "application/pdf", "text/plain"],
    }, sessionToken);
    if (!previewResolution.ok || !previewResolution.data) {
      setAssetActionStateForRun(executionId, assetId, Object.freeze({
        previewStatus: previewResolution.error?.code === "forbidden" ? "restricted" : "unavailable",
        previewMessage: toUserFacingAssetWorkflowError(previewResolution.error, "Preview is currently unavailable."),
        previewPath: undefined,
        downloadStatus: currentState?.downloadStatus ?? "idle",
        downloadMessage: currentState?.downloadMessage,
        downloadPath: currentState?.downloadPath,
      }));
      return;
    }

    const authorized = await assetWorkflowService.authorizeDownload({
      workspaceId,
      assetId: previewResolution.data.preview.previewAssetId ?? assetId,
      versionId: previewResolution.data.preview.previewVersionId,
      purpose: "inline-preview",
    }, sessionToken);
    if (!authorized.ok || !authorized.data) {
      setAssetActionStateForRun(executionId, assetId, Object.freeze({
        previewStatus: authorized.error?.code === "forbidden" ? "restricted" : "error",
        previewMessage: toUserFacingAssetWorkflowError(authorized.error, "Preview authorization failed."),
        previewPath: undefined,
        downloadStatus: currentState?.downloadStatus ?? "idle",
        downloadMessage: currentState?.downloadMessage,
        downloadPath: currentState?.downloadPath,
      }));
      return;
    }

    setAssetActionStateForRun(executionId, assetId, Object.freeze({
      previewStatus: "ready",
      previewMessage: `Preview authorized for ${authorized.data.authorization.mimeType}.`,
      previewPath: authorized.data.downloadPath,
      downloadStatus: currentState?.downloadStatus ?? "idle",
      downloadMessage: currentState?.downloadMessage,
      downloadPath: currentState?.downloadPath,
    }));
  }, [assetActionStateByExecutionAndAssetId, assetWorkflowService, ensureAssetDetail, sessionToken, setAssetActionStateForRun, workspaceId]);

  const requestProtectedDownload = useCallback(async (executionId: string, assetId: string): Promise<void> => {
    if (!sessionToken || !workspaceId) {
      return;
    }
    const currentState = assetActionStateByExecutionAndAssetId[executionId]?.[assetId];
    setAssetActionStateForRun(executionId, assetId, Object.freeze({
      previewStatus: currentState?.previewStatus ?? "idle",
      previewMessage: currentState?.previewMessage,
      previewPath: currentState?.previewPath,
      downloadStatus: "loading",
      downloadMessage: undefined,
      downloadPath: undefined,
    }));
    const detail = await ensureAssetDetail(executionId, assetId);
    if (detail?.allowedActions && !detail.allowedActions.canAuthorizeDownload) {
      setAssetActionStateForRun(executionId, assetId, Object.freeze({
        previewStatus: currentState?.previewStatus ?? "idle",
        previewMessage: currentState?.previewMessage,
        previewPath: currentState?.previewPath,
        downloadStatus: "restricted",
        downloadMessage: "Download is restricted for this asset by authorization policy.",
        downloadPath: undefined,
      }));
      return;
    }

    const authorized = await assetWorkflowService.authorizeDownload({
      workspaceId,
      assetId,
      purpose: "download",
    }, sessionToken);
    if (!authorized.ok || !authorized.data) {
      setAssetActionStateForRun(executionId, assetId, Object.freeze({
        previewStatus: currentState?.previewStatus ?? "idle",
        previewMessage: currentState?.previewMessage,
        previewPath: currentState?.previewPath,
        downloadStatus: authorized.error?.code === "forbidden" ? "restricted" : "error",
        downloadMessage: toUserFacingAssetWorkflowError(authorized.error, "Download authorization failed."),
        downloadPath: undefined,
      }));
      return;
    }

    setAssetActionStateForRun(executionId, assetId, Object.freeze({
      previewStatus: currentState?.previewStatus ?? "idle",
      previewMessage: currentState?.previewMessage,
      previewPath: currentState?.previewPath,
      downloadStatus: "ready",
      downloadMessage: `Download authorized for ${authorized.data.authorization.mimeType} (${authorized.data.authorization.sizeBytes} bytes).`,
      downloadPath: authorized.data.downloadPath,
    }));
  }, [assetActionStateByExecutionAndAssetId, assetWorkflowService, ensureAssetDetail, sessionToken, setAssetActionStateForRun, workspaceId]);

  const actorPermissionIds = useMemo(() => {
    const roles = new Set(session?.workspaceContext?.workspaces
      .flatMap((workspace) => workspace.effectiveRoles ?? [])
      ?? []);
    const permissions = new Set<string>([
      "runtime.run.inspect",
      "runtime.queue.refresh",
      "runtime.run.start",
    ]);
    if (roles.has("owner") || roles.has("admin") || session?.initialCapabilityState?.canAdministrate) {
      permissions.add("runtime.run.cancel");
      permissions.add("runtime.queue.manage");
    }
    return Object.freeze([...permissions]);
  }, [session?.initialCapabilityState?.canAdministrate, session?.workspaceContext?.workspaces]);

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
    <div className="ui-stack ui-stack--md">
      <OperationalRealtimeBanner
        connectionState={runtimeRealtimeConnectionState}
        onRefresh={() => {
          void refreshRuntimeQueue();
        }}
        onReconnect={requestRealtimeReconnect}
      />
      <OperationalWorkspaceDashboard
        model={dashboardModel}
        queueItems={runtimeQueueItems}
        recentRuns={history}
        recentOutputs={recentOutputs}
        isQueueLoading={isRuntimeQueueLoading}
        isRecentOutputsLoading={isRecentOutputsLoading}
        queueError={runtimeQueueError}
        recentOutputsError={recentOutputsError}
        realtimeConnectionState={runtimeRealtimeConnectionState}
        responsiveProfile={responsiveProfile}
        onRefreshQueue={() => {
          void refreshRuntimeQueue();
        }}
        onInspectRun={(executionId) => {
          setRuntimeExecutionId(executionId);
          setSelectedResultExecutionId(executionId);
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
      <OperationalRunListPanel
        queueItems={runtimeQueueItems}
        recentRuns={history}
        selectedExecutionId={runtimeExecutionId || runtimeExecutionState?.executionId}
        isQueueLoading={isRuntimeQueueLoading}
        queueError={runtimeQueueError}
        realtimeConnectionState={runtimeRealtimeConnectionState}
        responsiveProfile={responsiveProfile}
        actorPermissionIds={actorPermissionIds}
        surface={isDesktopSurface ? "desktop" : "thin-client"}
        onRefreshQueue={() => {
          void refreshRuntimeQueue();
        }}
        onInspectRun={(executionId) => {
          setRuntimeExecutionId(executionId);
          setSelectedResultExecutionId(executionId);
          void inspectRuntimeExecution(executionId);
        }}
        onCancelRun={(executionId) => {
          void runtimeOperationsService.cancelRun({
            executionId,
            reason: "Cancelled from run list.",
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
            reason: "Dequeued from run list.",
          }).then((response) => {
            if (!response.ok) {
              setRuntimeQueueError(response.error?.message ?? "Failed to dequeue runtime item.");
              return;
            }
            return refreshRuntimeQueue();
          });
        }}
      />
      <OperationalQueueVisibilityPanel
        queueItems={runtimeQueueItems}
        totalCount={runtimeQueueItems.length}
        selectedQueueItemId={selectedQueueItemId}
        filters={queueFilters}
        isLoading={isRuntimeQueueLoading}
        error={runtimeQueueError}
        realtimeConnectionState={runtimeRealtimeConnectionState}
        responsiveProfile={responsiveProfile}
        actorPermissionIds={actorPermissionIds}
        surface={isDesktopSurface ? "desktop" : "thin-client"}
        onFiltersChanged={(next) => {
          setQueueFilters(next);
        }}
        onRefreshQueue={() => {
          void refreshRuntimeQueue();
        }}
        onInspectRun={(executionId) => {
          setRuntimeExecutionId(executionId);
          setSelectedResultExecutionId(executionId);
          void inspectRuntimeExecution(executionId);
        }}
        onCancelRun={(executionId) => {
          void runtimeOperationsService.cancelRun({
            executionId,
            reason: "Cancelled from queue visibility panel.",
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
            reason: "Dequeued from queue visibility panel.",
          }).then((response) => {
            if (!response.ok) {
              setRuntimeQueueError(response.error?.message ?? "Failed to dequeue runtime item.");
              return;
            }
            return refreshRuntimeQueue();
          });
        }}
        onSelectQueueItem={(queueItemId) => {
          setSelectedQueueItemId(queueItemId);
        }}
      />
      <OperationalResultReviewPanels
        entries={resultReviewEntries}
        selectedExecutionId={activeResultExecutionId}
        detailIsLoading={isRunDetailLoading}
        detailError={runtimeExecutionError}
        responsiveProfile={responsiveProfile}
        assetDetailsByExecutionAndAssetId={assetDetailByExecutionAndAssetId}
        actionStateByExecutionAndAssetId={assetActionStateByExecutionAndAssetId}
        onSelectExecution={(executionId) => {
          setSelectedResultExecutionId(executionId);
          setRuntimeExecutionId(executionId);
          void inspectRuntimeExecution(executionId);
        }}
        onRequestPreview={(executionId, assetId) => {
          void requestProtectedPreview(executionId, assetId);
        }}
        onRequestDownload={(executionId, assetId) => {
          void requestProtectedDownload(executionId, assetId);
        }}
      />
    </div>
  );

  const detail = (
    <div className="ui-stack ui-stack--sm" data-testid="run-dashboard-controls">
      <OperationalApprovedRunLaunchPanel
        responsiveProfile={responsiveProfile}
        surface={isDesktopSurface ? "desktop" : "thin-client"}
        onSubmit={launchApprovedRun}
        onRunAccepted={(data) => {
          setRuntimeExecutionId(data.executionId);
          setSelectedResultExecutionId(data.executionId);
          void inspectRuntimeExecution(data.executionId);
          void refreshRuntimeQueue();
          void loadHistory();
        }}
        openSystemRunnerPath={ROUTE_PATHS.systemStudio}
      />

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Direct run lookup</h2>
          <p className="ui-card__subtitle">Inspect a specific execution id when it is outside the current run list window.</p>
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
        </div>
      </section>
      <OperationalRunDetailStatusPanel
        selectedExecutionId={runtimeExecutionId || runtimeExecutionState?.executionId}
        inspection={runtimeExecutionState}
        runDetail={selectedRunDetail}
        isLoading={isRunDetailLoading}
        error={runtimeExecutionError}
        realtimeConnectionState={runtimeRealtimeConnectionState}
        responsiveProfile={responsiveProfile}
        actorPermissionIds={actorPermissionIds}
        surface={isDesktopSurface ? "desktop" : "thin-client"}
        onRefresh={() => {
          const selectedId = runtimeExecutionId.trim() || runtimeExecutionState?.executionId;
          if (!selectedId) {
            return;
          }
          void inspectRuntimeExecution(selectedId);
        }}
        onCancel={(executionId) => {
          void runtimeOperationsService.cancelRun({
            executionId,
            reason: "Cancelled from run detail.",
          }).then((response) => {
            if (!response.ok) {
              setRuntimeExecutionError(response.error?.message ?? "Failed to cancel runtime execution.");
              return;
            }
            void inspectRuntimeExecution(executionId);
            void refreshRuntimeQueue();
          });
        }}
      />
      <OperationalQueueDetailPanel
        queueItems={runtimeQueueItems}
        selectedQueueItemId={selectedQueueItemId}
        responsiveProfile={responsiveProfile}
        actorPermissionIds={actorPermissionIds}
        surface={isDesktopSurface ? "desktop" : "thin-client"}
        isLoading={isRuntimeQueueLoading}
        error={runtimeQueueError}
        realtimeConnectionState={runtimeRealtimeConnectionState}
        onRefreshQueue={() => {
          void refreshRuntimeQueue();
        }}
        onInspectRun={(executionId) => {
          setRuntimeExecutionId(executionId);
          setSelectedResultExecutionId(executionId);
          void inspectRuntimeExecution(executionId);
        }}
        onCancelRun={(executionId) => {
          void runtimeOperationsService.cancelRun({
            executionId,
            reason: "Cancelled from queue detail panel.",
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
            reason: "Dequeued from queue detail panel.",
          }).then((response) => {
            if (!response.ok) {
              setRuntimeQueueError(response.error?.message ?? "Failed to dequeue runtime item.");
              return;
            }
            return refreshRuntimeQueue();
          });
        }}
      />
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
