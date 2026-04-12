import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AuthoritativeReplayExecutionResultKinds,
  type IOfflineConnectivityStatePort,
  type IOfflineAuthoritativeResynchronizationPort,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import {
  OfflineConnectivityStates,
  type OfflineConnectivitySurfaceStateDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import {
  OfflineQueuedMutationIntents,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  createOfflineQueuedMutationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { resolveDesktopStoragePaths } from "@infrastructure/desktop/DesktopAppPaths";
import { createDesktopOfflineResynchronizationHostRuntime } from "../DesktopOfflineResynchronizationHost";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

class NoopAuthoritativePort implements IOfflineAuthoritativeResynchronizationPort {
  public async fetchResourceRevisions(_input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceRevisions"]>[0]) {
    return Object.freeze([]);
  }

  public async replayPreparedOperation(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedOperation"]>[0],
  ) {
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.failed,
      reason: "noop",
    });
  }

  public async replayPreparedLocalExecutionRegistration(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedLocalExecutionRegistration"]>[0],
  ) {
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.failed,
      reason: "noop",
    });
  }

  public async fetchResourceSnapshotForCache(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceSnapshotForCache"]>[0],
  ) {
    return undefined;
  }
}

class AppliedAuthoritativePort implements IOfflineAuthoritativeResynchronizationPort {
  public async fetchResourceRevisions(
    input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceRevisions"]>[0],
  ) {
    return Object.freeze(input.resources.map((resource) => Object.freeze({
      resourceClass: resource.resourceClass,
      resourceId: resource.resourceId,
      authoritativeRevision: "rev:2",
    })));
  }

  public async replayPreparedOperation(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedOperation"]>[0],
  ) {
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "applied",
      authoritativeRevisionAfter: "rev:2",
    });
  }

  public async replayPreparedLocalExecutionRegistration(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedLocalExecutionRegistration"]>[0],
  ) {
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "applied",
      authoritativeRevisionAfter: "rev:2",
    });
  }

  public async fetchResourceSnapshotForCache(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceSnapshotForCache"]>[0],
  ) {
    return undefined;
  }
}

class StaticConnectivityPort implements IOfflineConnectivityStatePort {
  constructor(private readonly state: OfflineConnectivitySurfaceStateDto) {}

  public async getConnectivityState(): Promise<OfflineConnectivitySurfaceStateDto> {
    return this.state;
  }
}

function createConnectedState(): OfflineConnectivitySurfaceStateDto {
  return Object.freeze({
    state: OfflineConnectivityStates.connected,
    stale: false,
    localModeActive: false,
    lastChangedAt: "2026-04-08T12:00:00.000Z",
    canQueueOperations: true,
    canResynchronize: true,
  });
}

function createPendingOperationEnvelope(operationId: string) {
  return createOfflineQueuedMutationEnvelope({
    mutationId: operationId,
    targetResourceClass: OfflineResourceClasses.workflowDraft,
    targetResourceId: `workflow:draft:${operationId}`,
    intent: OfflineQueuedMutationIntents.promoteLocalDraft,
    baseAuthoritativeRevision: "rev:1",
    localMutationRevision: 1,
    queuedAt: "2026-04-08T12:10:00.000Z",
    userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
    divergenceDisclosureToken: `offline-warning:${operationId}`,
    replayDescriptor: {
      method: "PATCH",
      path: `/v1/workflows/drafts/${operationId}/promote`,
      idempotencyKey: `idem:${operationId}`,
      payload: Object.freeze({ operationId }),
    },
  });
}

describe("DesktopOfflineResynchronizationHost", () => {
  it("creates desktop controlled resynchronization runtime composition", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-resync-host-"));
    tempRoots.push(root);
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflineResynchronizationHostRuntime({
      storagePaths,
      authoritativePort: new NoopAuthoritativePort(),
      supportsProtectedAtRestStorage: true,
    });

    expect(runtime.coordinator).toBeDefined();
    expect(runtime.recoveryService).toBeDefined();
    expect(runtime.pendingOperationRuntime.databasePath).toContain("offline-pending-operation-queue.sqlite");
    expect(runtime.localExecutionRegistrationRuntime.databasePath)
      .toContain("offline-local-execution-registration-queue.sqlite");
    expect(runtime.snapshotCacheRuntime.databasePath).toContain("offline-authoritative-snapshot-cache.sqlite");
    expect(runtime.recoveryDatabasePath).toContain("offline-resynchronization-recovery.sqlite");
    runtime.dispose();
  });

  it("tracks resynchronization attempt markers around host synchronize wrapper", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-resync-wrapper-"));
    tempRoots.push(root);
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflineResynchronizationHostRuntime({
      storagePaths,
      authoritativePort: new NoopAuthoritativePort(),
      connectivityStatePort: new StaticConnectivityPort(createConnectedState()),
      supportsProtectedAtRestStorage: true,
    });

    await runtime.pendingOperationRuntime.service.queueOperation({
      operation: createPendingOperationEnvelope("operation:wrapper:1"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    await runtime.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      syncAttemptId: "sync:wrapper:1",
      attemptedAt: "2026-04-08T12:30:00.000Z",
    });

    const attempts = await runtime.recoveryRepository.listAttemptsByWorkspace("workspace:alpha");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      syncAttemptId: "sync:wrapper:1",
      status: "completed",
    });
    runtime.dispose();
  });

  it("retries interrupted attempt during startup recovery when retryable work remains", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-resync-startup-recovery-"));
    tempRoots.push(root);
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflineResynchronizationHostRuntime({
      storagePaths,
      authoritativePort: new AppliedAuthoritativePort(),
      connectivityStatePort: new StaticConnectivityPort(createConnectedState()),
      supportsProtectedAtRestStorage: true,
    });

    await runtime.pendingOperationRuntime.service.queueOperation({
      operation: createPendingOperationEnvelope("operation:startup:1"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await runtime.recoveryRepository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      syncAttemptId: "sync:interrupted:startup:1",
      startedAt: "2026-04-08T12:29:00.000Z",
    });

    const recovery = await runtime.recoverStartupState({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      checkedAt: "2026-04-08T12:31:00.000Z",
      autoRetryInterruptedResynchronization: true,
    });

    expect(recovery.autoResynchronizationAttempted).toBeTrue();
    expect(recovery.autoResynchronizationResult?.syncAttemptId).toBe("sync:interrupted:startup:1");
    const remainingOperation = await runtime.pendingOperationRuntime.service.findQueuedOperation(
      "workspace:alpha",
      "operation:startup:1",
    );
    expect(remainingOperation).toBeUndefined();
    const attempts = await runtime.recoveryRepository.listAttemptsByWorkspace("workspace:alpha");
    expect(attempts[0]?.status).toBe("completed");
    runtime.dispose();
  });
});
