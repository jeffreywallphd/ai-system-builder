import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";
import { OfflineControlledResynchronizationCoordinator } from "@application/common/OfflineControlledResynchronizationCoordinator";
import type { IOfflineOperationalEventSink } from "@application/common/OfflineOperationalEventPorts";
import type {
  OfflineControlledResynchronizationResult,
  IOfflineResynchronizationPolicyPort,
  IOfflineAuthoritativeResynchronizationPort,
  IOfflineConnectivityStatePort,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import { OfflineDesktopStartupRecoveryService } from "@application/common/OfflineDesktopStartupRecovery";
import { DesktopConnectivityStateService } from "./DesktopConnectivityStateService";
import {
  createDesktopOfflinePendingOperationHostRuntime,
  type DesktopOfflinePendingOperationHostRuntime,
} from "./DesktopOfflinePendingOperationHost";
import {
  createDesktopOfflineLocalExecutionRegistrationHostRuntime,
  type DesktopOfflineLocalExecutionRegistrationHostRuntime,
} from "./DesktopOfflineLocalExecutionRegistrationHost";
import {
  createDesktopOfflineSnapshotCacheHostRuntime,
  type DesktopOfflineSnapshotCacheHostRuntime,
} from "./DesktopOfflineSnapshotCacheHost";
import type { DesktopOfflineLocalModePolicyResolutionOptions } from "./DesktopOfflineLocalModeProfile";
import { DesktopOfflineResynchronizationRecoveryRepository } from "@infrastructure/desktop/DesktopOfflineResynchronizationRecoveryRepository";
import path from "node:path";

export interface DesktopOfflineResynchronizationHostOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly authoritativePort: IOfflineAuthoritativeResynchronizationPort;
  readonly connectivityStatePort?: IOfflineConnectivityStatePort;
  readonly pendingOperationMaxEntries?: number;
  readonly localExecutionRegistrationMaxEntries?: number;
  readonly snapshotCacheMaxEntries?: number;
  readonly resynchronizationRecoveryMaxEntries?: number;
  readonly supportsProtectedAtRestStorage?: boolean;
  readonly localModePolicy?: DesktopOfflineLocalModePolicyResolutionOptions;
  readonly resynchronizationPolicyPort?: IOfflineResynchronizationPolicyPort;
  readonly eventSink?: IOfflineOperationalEventSink;
  readonly eventContext?: {
    readonly workspaceId?: string;
    readonly actorUserIdentityId?: string;
  };
  readonly now?: () => Date;
}

export interface DesktopOfflineResynchronizationHostRuntime {
  readonly coordinator: OfflineControlledResynchronizationCoordinator;
  readonly recoveryService: OfflineDesktopStartupRecoveryService;
  readonly recoveryRepository: DesktopOfflineResynchronizationRecoveryRepository;
  readonly recoveryDatabasePath: string;
  readonly pendingOperationRuntime: DesktopOfflinePendingOperationHostRuntime;
  readonly localExecutionRegistrationRuntime: DesktopOfflineLocalExecutionRegistrationHostRuntime;
  readonly snapshotCacheRuntime: DesktopOfflineSnapshotCacheHostRuntime;
  readonly connectivityStatePort: IOfflineConnectivityStatePort;
  synchronizeWorkspace(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly requestId?: string;
    readonly syncAttemptId?: string;
    readonly attemptedAt?: string;
  }): Promise<OfflineControlledResynchronizationResult>;
  recoverStartupState(input: {
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly requestId?: string;
    readonly checkedAt?: string;
    readonly autoRetryInterruptedResynchronization?: boolean;
  }): ReturnType<OfflineDesktopStartupRecoveryService["recoverWorkspaceStartup"]>;
  dispose(): void;
}

class DesktopConnectivityStatePortAdapter implements IOfflineConnectivityStatePort {
  constructor(private readonly connectivityStateService: DesktopConnectivityStateService) {}

  public async getConnectivityState() {
    return this.connectivityStateService.getState();
  }
}

const OFFLINE_RESYNCHRONIZATION_RECOVERY_DATABASE_NAME = "offline-resynchronization-recovery.sqlite";

export function createDesktopOfflineResynchronizationHostRuntime(
  options: DesktopOfflineResynchronizationHostOptions,
): DesktopOfflineResynchronizationHostRuntime {
  const pendingOperationRuntime = createDesktopOfflinePendingOperationHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.pendingOperationMaxEntries,
    localModePolicy: options.localModePolicy,
  });
  const localExecutionRegistrationRuntime = createDesktopOfflineLocalExecutionRegistrationHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.localExecutionRegistrationMaxEntries,
    localModePolicy: options.localModePolicy,
  });
  const snapshotCacheRuntime = createDesktopOfflineSnapshotCacheHostRuntime({
    storagePaths: options.storagePaths,
    maxEntries: options.snapshotCacheMaxEntries,
    supportsProtectedAtRestStorage: options.supportsProtectedAtRestStorage,
    localModePolicy: options.localModePolicy,
  });
  const connectivityStatePort = options.connectivityStatePort
    ?? new DesktopConnectivityStatePortAdapter(new DesktopConnectivityStateService({
      now: options.now,
      eventSink: options.eventSink,
      eventContext: options.eventContext,
    }));
  const recoveryDatabasePath = path.join(
    options.storagePaths.storageDirectory,
    OFFLINE_RESYNCHRONIZATION_RECOVERY_DATABASE_NAME,
  );
  const recoveryRepository = new DesktopOfflineResynchronizationRecoveryRepository({
    databasePath: recoveryDatabasePath,
    maxEntries: options.resynchronizationRecoveryMaxEntries,
  });

  const coordinator = new OfflineControlledResynchronizationCoordinator(
    pendingOperationRuntime.service,
    localExecutionRegistrationRuntime.service,
    snapshotCacheRuntime.service,
    options.authoritativePort,
    connectivityStatePort,
    {
      now: options.now,
      eventSink: options.eventSink,
      resynchronizationPolicyPort: options.resynchronizationPolicyPort,
    },
  );
  const recoveryService = new OfflineDesktopStartupRecoveryService(
    pendingOperationRuntime.service,
    localExecutionRegistrationRuntime.service,
    snapshotCacheRuntime.service,
    connectivityStatePort,
    recoveryRepository,
    {
      now: options.now,
    },
  );
  const now = options.now ?? (() => new Date());
  const synchronizeWorkspace: DesktopOfflineResynchronizationHostRuntime["synchronizeWorkspace"] = async (input) => {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const attemptedAt = normalizeIsoTimestamp(input.attemptedAt ?? now().toISOString(), "attemptedAt");
    const syncAttemptId = normalizeOptional(input.syncAttemptId) ?? makeSyncAttemptId(workspaceId, attemptedAt);
    await recoveryRepository.markAttemptStarted({
      workspaceId,
      actorUserIdentityId,
      requestId: normalizeOptional(input.requestId),
      syncAttemptId,
      startedAt: attemptedAt,
    });

    try {
      const result = await coordinator.synchronizeWorkspace({
        workspaceId,
        actorUserIdentityId,
        requestId: normalizeOptional(input.requestId),
        syncAttemptId,
        attemptedAt,
      });
      await recoveryRepository.markAttemptCompleted({
        workspaceId,
        syncAttemptId,
        completedAt: attemptedAt,
        completionOutcome: deriveResynchronizationOutcome(result),
      });
      return result;
    } catch (error) {
      await recoveryRepository.markAttemptCompleted({
        workspaceId,
        syncAttemptId,
        completedAt: attemptedAt,
        completionOutcome: "failed",
        lastErrorSummary: summarizeError(error),
      });
      throw error;
    }
  };
  const recoverStartupState: DesktopOfflineResynchronizationHostRuntime["recoverStartupState"] = async (input) => {
    return recoveryService.recoverWorkspaceStartup({
      workspaceId: input.workspaceId,
      actorUserIdentityId: input.actorUserIdentityId,
      requestId: input.requestId,
      checkedAt: input.checkedAt,
      autoRetryInterruptedResynchronization: input.autoRetryInterruptedResynchronization,
      executeResynchronization: synchronizeWorkspace,
    });
  };

  return Object.freeze({
    coordinator,
    recoveryService,
    recoveryRepository,
    recoveryDatabasePath,
    pendingOperationRuntime,
    localExecutionRegistrationRuntime,
    snapshotCacheRuntime,
    connectivityStatePort,
    synchronizeWorkspace,
    recoverStartupState,
    dispose: () => {
      pendingOperationRuntime.dispose();
      localExecutionRegistrationRuntime.dispose();
      snapshotCacheRuntime.dispose();
      recoveryRepository.dispose();
    },
  });
}

function deriveResynchronizationOutcome(
  result: OfflineControlledResynchronizationResult,
): "succeeded" | "failed" | "conflict" {
  const hasFailures = result.outcomes.some((entry) => entry.action !== "apply-to-authoritative");
  if (!hasFailures) {
    return "succeeded";
  }
  const hasConflict = result.outcomes.some((entry) => entry.action === "conflict-requires-review");
  return hasConflict ? "conflict" : "failed";
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error instanceof Error && error.name.trim()) {
    return error.name.trim();
  }
  return "offline-resynchronization-failed";
}

function makeSyncAttemptId(workspaceId: string, attemptedAt: string): string {
  const safeWorkspace = workspaceId.replace(/[^a-z0-9:_-]+/gi, "-");
  const safeAttemptedAt = attemptedAt.replace(/[^0-9A-Za-z]+/g, "-");
  return `offline-sync:${safeWorkspace}:${safeAttemptedAt}`;
}
