import { describe, expect, it } from "bun:test";
import {
  type IOfflineLocalExecutionRegistrationRepository,
  type OfflineLocalExecutionRegistrationRecord,
  OfflineLocalExecutionRegistrationRetryBackoffPolicies,
  OfflineLocalExecutionRegistrationService,
} from "../OfflineLocalExecutionRegistrationPersistence";
import {
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineNodeOperationalModes,
  OfflineResourceClasses,
  OfflineWorkstationModes,
  createOfflineLocalExecutionRecord,
  createOfflineLocalExecutionRegistrationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";

class InMemoryOfflineLocalExecutionRegistrationRepository implements IOfflineLocalExecutionRegistrationRepository {
  private readonly records = new Map<string, OfflineLocalExecutionRegistrationRecord>();

  public async upsertRegistration(record: OfflineLocalExecutionRegistrationRecord): Promise<void> {
    this.records.set(this.makeKey(record.actorWorkspaceContext.workspaceId, record.registration.registrationId), record);
  }

  public async findRegistration(
    workspaceId: string,
    registrationId: string,
  ): Promise<OfflineLocalExecutionRegistrationRecord | undefined> {
    return this.records.get(this.makeKey(workspaceId, registrationId));
  }

  public async listRegistrationsByWorkspace(
    workspaceId: string,
  ): Promise<ReadonlyArray<OfflineLocalExecutionRegistrationRecord>> {
    return Object.freeze(
      [...this.records.values()].filter((entry) => entry.actorWorkspaceContext.workspaceId === workspaceId),
    );
  }

  public async deleteRegistration(workspaceId: string, registrationId: string): Promise<boolean> {
    return this.records.delete(this.makeKey(workspaceId, registrationId));
  }

  private makeKey(workspaceId: string, registrationId: string): string {
    return `${workspaceId}::${registrationId}`;
  }
}

function createQueuedRegistration(input: {
  readonly registrationId: string;
  readonly executionId: string;
  readonly queuedAt?: string;
}) {
  const execution = createOfflineLocalExecutionRecord({
    executionId: input.executionId,
    executionClass: OfflineLocalExecutionClasses.localWorkflowPreview,
    resourceClass: OfflineResourceClasses.localRuntimeSession,
    resourceId: `runtime:session:${input.executionId}`,
    startedAt: "2026-04-08T10:00:00.000Z",
    completedAt: "2026-04-08T10:00:10.000Z",
    executedByActorUserIdentityId: "user:alpha",
    nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
    workstationMode: OfflineWorkstationModes.interactiveUserSession,
    outcome: OfflineLocalExecutionOutcomes.succeeded,
    inputDigest: `sha256:input:${input.executionId}`,
    outputs: [{
      outputId: `output:${input.executionId}`,
      outputClass: OfflineLocalExecutionOutputClasses.previewArtifact,
      contentDigest: `sha256:output:${input.executionId}`,
      sizeBytes: 128,
    }],
  });

  return createOfflineLocalExecutionRegistrationEnvelope({
    registrationId: input.registrationId,
    execution,
    queuedAt: input.queuedAt ?? "2026-04-08T10:00:11.000Z",
    divergenceDisclosureToken: `offline-warning:${input.registrationId}`,
    replayDescriptor: {
      method: "POST",
      path: `/v1/offline/local-executions/${input.executionId}/register`,
      idempotencyKey: `idem:${input.registrationId}`,
      payload: Object.freeze({ executionId: input.executionId }),
    },
  });
}

describe("OfflineLocalExecutionRegistrationService", () => {
  it("queues local execution registrations with canonical metadata and actor/workspace context", async () => {
    const repository = new InMemoryOfflineLocalExecutionRegistrationRepository();
    const service = new OfflineLocalExecutionRegistrationService(repository);
    const registration = createQueuedRegistration({
      registrationId: "registration:queue:1",
      executionId: "execution:queue:1",
    });

    const record = await service.queueRegistration({
      registration,
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 1,
        maxRetryCount: 4,
        backoffPolicy: OfflineLocalExecutionRegistrationRetryBackoffPolicies.fixed,
        nextEligibleReplayAt: "2026-04-08T10:05:00.000Z",
      },
    });

    expect(record.localStateScope).toBe("unsynced-local-registration-pending");
    expect(record.actorWorkspaceContext.workspaceId).toBe("workspace:alpha");
    expect(record.registration.execution.historyScope).toBe("explicit-local-activity");
    expect(record.canonicalExecutionMetadataJson).toContain("\"executionId\":\"execution:queue:1\"");
    expect(record.canonicalExecutionMetadataDigest.length).toBeGreaterThan(10);
  });

  it("prepares local execution registration replay deterministically with retryability gates", async () => {
    const repository = new InMemoryOfflineLocalExecutionRegistrationRepository();
    const service = new OfflineLocalExecutionRegistrationService(repository);

    await service.queueRegistration({
      registration: createQueuedRegistration({
        registrationId: "registration:a",
        executionId: "execution:a",
        queuedAt: "2026-04-08T10:00:00.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await service.queueRegistration({
      registration: createQueuedRegistration({
        registrationId: "registration:b",
        executionId: "execution:b",
        queuedAt: "2026-04-08T10:00:01.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 2,
        maxRetryCount: 2,
        backoffPolicy: OfflineLocalExecutionRegistrationRetryBackoffPolicies.exponential,
      },
    });
    await service.queueRegistration({
      registration: createQueuedRegistration({
        registrationId: "registration:c",
        executionId: "execution:c",
        queuedAt: "2026-04-08T10:00:02.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 0,
        maxRetryCount: 2,
        backoffPolicy: OfflineLocalExecutionRegistrationRetryBackoffPolicies.fixed,
        nextEligibleReplayAt: "2026-04-08T11:00:00.000Z",
      },
    });

    const prepared = await service.prepareReplayRegistrations({
      workspaceId: "workspace:alpha",
      preparedAt: "2026-04-08T10:10:00.000Z",
    });

    expect(prepared.prepared.map((entry) => entry.registrationId)).toEqual(["registration:a"]);
    const blockedReasonsByRegistrationId = new Map(prepared.blocked.map((entry) => [entry.registrationId, entry.reasonCode]));
    expect(blockedReasonsByRegistrationId.get("registration:b")).toBe("retry-exhausted");
    expect(blockedReasonsByRegistrationId.get("registration:c")).toBe("retry-not-eligible");
  });

  it("updates local execution registration replay status for conflict/rejected outcomes", async () => {
    const repository = new InMemoryOfflineLocalExecutionRegistrationRepository();
    const service = new OfflineLocalExecutionRegistrationService(repository);
    await service.queueRegistration({
      registration: createQueuedRegistration({
        registrationId: "registration:outcome:1",
        executionId: "execution:outcome:1",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:gamma",
        actorUserIdentityId: "user:gamma",
      },
    });

    const conflicted = await service.markRegistrationReplayOutcome({
      workspaceId: "workspace:gamma",
      registrationId: "registration:outcome:1",
      nextStatus: "registration-conflict",
      attemptedAt: "2026-04-08T10:35:00.000Z",
      incrementRetryCount: true,
    });
    expect(conflicted.registration.userVisibleRegistrationStatus).toBe("registration-conflict");
    expect(conflicted.retryability.retryCount).toBe(1);
    expect(conflicted.retryability.lastAttemptedAt).toBe("2026-04-08T10:35:00.000Z");

    const rejected = await service.markRegistrationReplayOutcome({
      workspaceId: "workspace:gamma",
      registrationId: "registration:outcome:1",
      nextStatus: "registration-rejected",
      attemptedAt: "2026-04-08T10:40:00.000Z",
      incrementRetryCount: false,
      retryable: false,
      nonRetryableReasonCode: "conflict-not-resolved",
    });
    expect(rejected.registration.userVisibleRegistrationStatus).toBe("registration-rejected");
    expect(rejected.retryability.retryable).toBeFalse();
    expect(rejected.retryability.nonRetryableReasonCode).toBe("conflict-not-resolved");

    const removed = await service.markRegistrationAsApplied("workspace:gamma", "registration:outcome:1");
    expect(removed).toBeTrue();
    const found = await service.findQueuedRegistration("workspace:gamma", "registration:outcome:1");
    expect(found).toBeUndefined();
  });
});
