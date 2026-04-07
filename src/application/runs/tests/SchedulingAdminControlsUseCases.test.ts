import { describe, expect, it } from "bun:test";
import type { AuthoritativeAuditRecordEventInput } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type { PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  AuthoritativeRunQueueEntryRecord,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  ListStaleSchedulingReservationsUseCase,
} from "@application/runs/use-cases/ListStaleSchedulingReservationsUseCase";
import {
  ReleaseStaleSchedulingReservationUseCase,
  ReleaseStaleSchedulingReservationValidationError,
} from "@application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase";
import {
  ReevaluateDeferredSchedulingRunsUseCase,
} from "@application/runs/use-cases/ReevaluateDeferredSchedulingRunsUseCase";

class StubIntentRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendOrchestrationIntent(event: PlatformAuditEventRecord): Promise<{
    readonly changed: boolean;
    readonly wasReplay: boolean;
    readonly record: PlatformAuditEventRecord;
  }> {
    this.events.push(event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }
}

class StubQueueRepository {
  public queueEntryByRunId = new Map<string, AuthoritativeRunQueueEntryRecord>();
  public staleReservations = Object.freeze([]);
  public reconsidered = Object.freeze<ReadonlyArray<AuthoritativeRunQueueEntryRecord>>([]);
  public releasedClaims: Array<{ runId: string; claimToken: string; releasedAt: string }> = [];

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.queueEntryByRunId.get(runId);
  }

  public async listQueueEntries(): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([...this.queueEntryByRunId.values()]);
  }

  public async listStaleQueueReservations() {
    return this.staleReservations;
  }

  public async reconsiderDeferredRunsForScheduling(): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return this.reconsidered;
  }

  public async enqueueRunForAssignment(): Promise<{ readonly changed: boolean; readonly record: AuthoritativeRunQueueEntryRecord; }> {
    throw new Error("Not implemented");
  }

  public async listAssignmentReadyRuns(): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([]);
  }

  public async claimAssignmentReadyRuns(): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([]);
  }

  public async releaseRunClaim(input: { readonly runId: string; readonly claimToken: string; readonly releasedAt: string; }): Promise<boolean> {
    this.releasedClaims.push({ runId: input.runId, claimToken: input.claimToken, releasedAt: input.releasedAt });
    return true;
  }

  public async claimQueuedRunForNodeDispatch() {
    throw new Error("Not implemented");
  }

  public async recordDispatchAttemptResult(): Promise<boolean> {
    return false;
  }

  public async finalizeRunQueueEntry(): Promise<boolean> {
    return false;
  }

  public async listDispatchAttemptsByRunId() {
    return Object.freeze([]);
  }
}

class CapturingAuthoritativeRunAuditRecorder {
  public readonly events: AuthoritativeAuditRecordEventInput[] = [];

  public async recordRunsEvent(input: AuthoritativeAuditRecordEventInput): Promise<any> {
    this.events.push(input);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      sequence: this.events.length,
      event: input,
    });
  }
}

describe("scheduling admin control use cases", () => {
  it("lists stale reservations with stale second projections", async () => {
    const queueRepository = new StubQueueRepository();
    queueRepository.staleReservations = Object.freeze([Object.freeze({
      runId: "run:1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      claimToken: "queue-claim:1",
      claimedBy: "scheduler:alpha",
      claimedAt: "2026-04-07T11:58:00.000Z",
      claimExpiresAt: "2026-04-07T12:00:00.000Z",
    })]);
    const useCase = new ListStaleSchedulingReservationsUseCase({
      queueRepository: queueRepository as never,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
    });
    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.staleSeconds).toBe(60);
  });

  it("releases stale reservations and records auditable events", async () => {
    const queueRepository = new StubQueueRepository();
    queueRepository.queueEntryByRunId.set("run:1", Object.freeze({
      runId: "run:1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-07T11:55:00.000Z",
      orderKey: "2026-04-07T11:55:00.000Z:run:1",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-07T11:55:00.000Z",
      claimToken: "queue-claim:1",
      claimedBy: "scheduler:alpha",
      claimedAt: "2026-04-07T11:58:00.000Z",
      claimExpiresAt: "2026-04-07T12:00:00.000Z",
      updatedAt: "2026-04-07T11:58:00.000Z",
      revision: 1,
    }));
    const intentRepository = new StubIntentRepository();
    const authoritativeAuditRecorder = new CapturingAuthoritativeRunAuditRecorder();
    const useCase = new ReleaseStaleSchedulingReservationUseCase({
      queueRepository: queueRepository as never,
      orchestrationIntentRepository: intentRepository as never,
      authoritativeAuditRecorder,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
      idGenerator: {
        nextId: (prefix) => `${prefix}:test`,
      },
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      runId: "run:1",
      claimToken: "queue-claim:1",
      releasedAt: "2026-04-07T12:01:00.000Z",
      reason: "manual stale release",
    });
    expect(result.staleSeconds).toBe(60);
    expect(queueRepository.releasedClaims).toHaveLength(1);
    expect(intentRepository.events[0]?.action).toBe("run.scheduling.admin.stale-reservation.released");
    expect(authoritativeAuditRecorder.events).toHaveLength(1);
    expect(authoritativeAuditRecorder.events[0]?.action).toBe("run.scheduling.admin.stale-reservation.released");
  });

  it("fails closed when attempting to release non-stale reservations", async () => {
    const queueRepository = new StubQueueRepository();
    queueRepository.queueEntryByRunId.set("run:1", Object.freeze({
      runId: "run:1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-07T11:55:00.000Z",
      orderKey: "2026-04-07T11:55:00.000Z:run:1",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-07T11:55:00.000Z",
      claimToken: "queue-claim:1",
      claimedBy: "scheduler:alpha",
      claimedAt: "2026-04-07T12:00:30.000Z",
      claimExpiresAt: "2026-04-07T12:03:00.000Z",
      updatedAt: "2026-04-07T12:00:30.000Z",
      revision: 1,
    }));
    const useCase = new ReleaseStaleSchedulingReservationUseCase({
      queueRepository: queueRepository as never,
      orchestrationIntentRepository: new StubIntentRepository() as never,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
    });

    await expect(useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      runId: "run:1",
      claimToken: "queue-claim:1",
      releasedAt: "2026-04-07T12:01:00.000Z",
    })).rejects.toBeInstanceOf(ReleaseStaleSchedulingReservationValidationError);
  });

  it("re-evaluates deferred runs and writes one audit event per run", async () => {
    const queueRepository = new StubQueueRepository();
    queueRepository.reconsidered = Object.freeze([
      Object.freeze({
        runId: "run:deferred:1",
        queueId: "queue:default",
        workspaceId: "workspace-alpha",
        lifecycleState: "queued",
        enteredAt: "2026-04-07T11:50:00.000Z",
        orderKey: "2026-04-07T11:50:00.000Z:run:deferred:1",
        eligibilityMarker: "ready",
        eligibleAt: "2026-04-07T12:01:00.000Z",
        updatedAt: "2026-04-07T12:01:00.000Z",
        revision: 2,
      }),
      Object.freeze({
        runId: "run:deferred:2",
        queueId: "queue:default",
        workspaceId: "workspace-alpha",
        lifecycleState: "queued",
        enteredAt: "2026-04-07T11:51:00.000Z",
        orderKey: "2026-04-07T11:51:00.000Z:run:deferred:2",
        eligibilityMarker: "ready",
        eligibleAt: "2026-04-07T12:01:00.000Z",
        updatedAt: "2026-04-07T12:01:00.000Z",
        revision: 2,
      }),
    ]);
    const intentRepository = new StubIntentRepository();
    const authoritativeAuditRecorder = new CapturingAuthoritativeRunAuditRecorder();
    const useCase = new ReevaluateDeferredSchedulingRunsUseCase({
      queueRepository: queueRepository as never,
      orchestrationIntentRepository: intentRepository as never,
      authoritativeAuditRecorder,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
      idGenerator: {
        nextId: (prefix) => `${prefix}:test`,
      },
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      queueId: "queue:default",
      reason: "manual nudge",
    });
    expect(result.reEvaluatedCount).toBe(2);
    expect(result.runIds).toEqual(["run:deferred:1", "run:deferred:2"]);
    expect(intentRepository.events).toHaveLength(2);
    expect(intentRepository.events[0]?.action).toBe("run.scheduling.admin.deferred.re-evaluated");
    expect(authoritativeAuditRecorder.events).toHaveLength(2);
    expect(authoritativeAuditRecorder.events[0]?.action).toBe("run.scheduling.admin.deferred.re-evaluated");
  });
});
