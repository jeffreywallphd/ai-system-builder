import {
  OfflineCacheFreshnessStates,
  OfflineConnectivityStates,
  OfflineLocalExecutionRegistrationStatuses,
  OfflineSynchronizationStates,
  type OfflineSynchronizationStateSnapshotDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";

export type DesktopOfflineBannerTone = "neutral" | "info" | "warning" | "danger" | "success";

export interface DesktopOfflineStatusSurfaceModel {
  readonly banner: {
    readonly tone: DesktopOfflineBannerTone;
    readonly title: string;
    readonly message: string;
  };
  readonly connectivity: {
    readonly label: string;
    readonly detail?: string;
    readonly stale: boolean;
    readonly lastChangedAtLabel: string;
  };
  readonly synchronization: {
    readonly stateLabel: string;
    readonly pendingCount: number;
    readonly conflictCount: number;
    readonly rejectedCount: number;
    readonly pendingRunSubmissionCount: number;
    readonly pendingExecutionRegistrationCount: number;
    readonly requiresAttention: boolean;
    readonly summary: string;
  };
  readonly cache: {
    readonly totalCount: number;
    readonly freshCount: number;
    readonly staleCount: number;
    readonly expiredCount: number;
    readonly summary: string;
  };
  readonly policy: {
    readonly unsupportedActions: ReadonlyArray<string>;
  };
  readonly actions: {
    readonly offlineModeToggleLabel: string;
    readonly refreshLabel: string;
  };
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return parsed.toLocaleString();
}

function buildBanner(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["banner"] {
  const { connectivity, status } = snapshot;
  const hasUnsyncedChanges = status.pendingOperationCount > 0
    || status.conflictCount > 0
    || status.rejectedCount > 0
    || snapshot.queue.pendingRunSubmissions.length > 0;

  if (connectivity.state === OfflineConnectivityStates.connected && hasUnsyncedChanges) {
    return Object.freeze({
      tone: "warning",
      title: "Connected with unsynced local changes",
      message: "Authoritative connectivity is available, but local queued work still needs reconciliation.",
    });
  }

  switch (connectivity.state) {
    case OfflineConnectivityStates.connected:
      return Object.freeze({
        tone: "success",
        title: "Connected to authoritative services",
        message: "Desktop state is online and can synchronize with the control plane.",
      });
    case OfflineConnectivityStates.reconnecting:
      return Object.freeze({
        tone: "info",
        title: "Reconnecting to authoritative services",
        message: connectivity.detail ?? "Transport recovery is in progress; local state remains bounded until reconnect completes.",
      });
    case OfflineConnectivityStates.degraded:
      return Object.freeze({
        tone: "warning",
        title: "Connectivity is degraded",
        message: connectivity.detail ?? "Some trusted session or transport prerequisites are unavailable.",
      });
    case OfflineConnectivityStates.disconnected:
      return Object.freeze({
        tone: "danger",
        title: connectivity.localModeActive ? "Offline local mode is active" : "Disconnected from authoritative services",
        message: connectivity.detail ?? "Only policy-limited local operations are available until trusted connectivity returns.",
      });
    default:
      return Object.freeze({
        tone: "neutral",
        title: "Connecting to authoritative services",
        message: "Connectivity status is being resolved.",
      });
  }
}

function buildConnectivityLabel(snapshot: OfflineSynchronizationStateSnapshotDto): string {
  const state = snapshot.connectivity.state;
  if (state === OfflineConnectivityStates.connected) {
    return "Online";
  }
  if (state === OfflineConnectivityStates.reconnecting) {
    return "Reconnecting";
  }
  if (state === OfflineConnectivityStates.degraded) {
    return "Degraded";
  }
  if (state === OfflineConnectivityStates.disconnected) {
    return snapshot.connectivity.localModeActive ? "Offline (local mode)" : "Offline";
  }
  return "Connecting";
}

function buildSynchronizationSummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["synchronization"] {
  const pendingExecutionRegistrationCount = snapshot.queue.localExecutionRegistrations.filter((entry) => (
    entry.userVisibleRegistrationStatus === OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration
  )).length;
  const pendingRunSubmissionCount = snapshot.queue.pendingRunSubmissions.length;
  const pendingCount = snapshot.status.pendingOperationCount;
  const conflictCount = snapshot.status.conflictCount;
  const rejectedCount = snapshot.status.rejectedCount;

  let stateLabel = "Idle";
  if (snapshot.status.state === OfflineSynchronizationStates.synchronizing) {
    stateLabel = "Synchronizing";
  } else if (snapshot.status.state === OfflineSynchronizationStates.blockedConflict) {
    stateLabel = "Blocked by conflicts";
  } else if (snapshot.status.state === OfflineSynchronizationStates.failed) {
    stateLabel = "Cannot synchronize";
  }

  const parts: string[] = [];
  if (pendingCount > 0) {
    parts.push(`${pendingCount} queued operation${pendingCount === 1 ? "" : "s"}`);
  }
  if (pendingExecutionRegistrationCount > 0) {
    parts.push(`${pendingExecutionRegistrationCount} pending local execution registration${pendingExecutionRegistrationCount === 1 ? "" : "s"}`);
  }
  if (pendingRunSubmissionCount > 0) {
    parts.push(`${pendingRunSubmissionCount} pending run submission${pendingRunSubmissionCount === 1 ? "" : "s"}`);
  }
  if (conflictCount > 0) {
    parts.push(`${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`);
  }
  if (rejectedCount > 0) {
    parts.push(`${rejectedCount} rejected operation${rejectedCount === 1 ? "" : "s"}`);
  }

  return Object.freeze({
    stateLabel,
    pendingCount,
    conflictCount,
    rejectedCount,
    pendingRunSubmissionCount,
    pendingExecutionRegistrationCount,
    requiresAttention: conflictCount > 0 || rejectedCount > 0,
    summary: parts.length > 0 ? parts.join(", ") : "No pending local synchronization work.",
  });
}

function buildCacheSummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["cache"] {
  const freshCount = snapshot.cachedResources.filter((item) => item.freshness === OfflineCacheFreshnessStates.fresh).length;
  const staleCount = snapshot.cachedResources.filter((item) => item.freshness === OfflineCacheFreshnessStates.stale).length;
  const expiredCount = snapshot.cachedResources.filter((item) => item.freshness === OfflineCacheFreshnessStates.expired).length;
  const totalCount = snapshot.cachedResources.length;

  const summary = totalCount === 0
    ? "No authoritative resources are currently cached on this desktop."
    : `${freshCount} fresh, ${staleCount} stale, ${expiredCount} expired cached resources.`;

  return Object.freeze({
    totalCount,
    freshCount,
    staleCount,
    expiredCount,
    summary,
  });
}

function buildUnsupportedActions(snapshot: OfflineSynchronizationStateSnapshotDto): ReadonlyArray<string> {
  const unsupported: string[] = [];
  if (!snapshot.connectivity.canQueueOperations) {
    unsupported.push("Authoritative write operations cannot be queued in the current connectivity state.");
  }
  if (!snapshot.connectivity.canResynchronize) {
    unsupported.push("Resynchronization is unavailable until trusted authoritative connectivity is restored.");
  }
  if (snapshot.status.state === OfflineSynchronizationStates.blockedConflict) {
    unsupported.push("Conflicts must be reviewed before replay can continue.");
  }
  if (snapshot.status.rejectedCount > 0) {
    unsupported.push("Rejected operations require manual intervention before retry.");
  }
  return Object.freeze(unsupported);
}

export function buildDesktopOfflineStatusSurfaceModel(
  snapshot: OfflineSynchronizationStateSnapshotDto,
): DesktopOfflineStatusSurfaceModel {
  return Object.freeze({
    banner: buildBanner(snapshot),
    connectivity: Object.freeze({
      label: buildConnectivityLabel(snapshot),
      detail: snapshot.connectivity.detail,
      stale: snapshot.connectivity.stale,
      lastChangedAtLabel: formatTimestamp(snapshot.connectivity.lastChangedAt),
    }),
    synchronization: buildSynchronizationSummary(snapshot),
    cache: buildCacheSummary(snapshot),
    policy: Object.freeze({
      unsupportedActions: buildUnsupportedActions(snapshot),
    }),
    actions: Object.freeze({
      offlineModeToggleLabel: snapshot.connectivity.localModeActive ? "Return online" : "Go offline",
      refreshLabel: "Refresh status",
    }),
  });
}
