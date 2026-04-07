import { describe, expect, it } from "bun:test";
import type {
  AuthoritativeRunNodePlacementHoldRecord,
  AuthoritativeRunNodePlacementHoldResult,
  IRunNodePlacementHoldRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunNodeClaimConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunNodeDispatchClaimConflictError } from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";
import { MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase } from "@application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase";
import type {
  ISchedulingGovernanceEventSink,
  SchedulingGovernanceEvent,
} from "@application/scheduling/ports/SchedulingGovernanceEventPorts";
import {
  createSchedulingDecisionBundle,
  createSchedulingOutcomeReason,
  type SchedulingDecisionBundle,
  SchedulingPolicyEvaluationReasonCodes,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";
import {
  SchedulingDecisionOutcomes,
  SchedulingPolicySourceKinds,
  createSchedulingPolicyDecision,
} from "@domain/scheduling/SchedulingDomain";

class RecordingQueueRepository implements Pick<IRunOrchestrationQueuePersistenceRepository, "releaseRunClaim" | "deferRunClaimForNoPlacement"> {
  public readonly releases: Array<{ readonly runId: string; readonly claimToken: string; readonly releasedAt: string }> = [];
  public readonly deferred: Array<{
    readonly runId: string;
    readonly claimToken: string;
    readonly deferredAt: string;
    readonly reasonCategory: string;
    readonly reasonCodes: ReadonlyArray<string>;
    readonly reasonMessage: string;
    readonly decisionId?: string;
    readonly requiresAdministrativeAttention?: boolean;
    readonly initialDelaySeconds?: number;
    readonly maxDelaySeconds?: number;
    readonly multiplier?: number;
  }> = [];

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    this.releases.push(input);
    return true;
  }

  public async deferRunClaimForNoPlacement(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly deferredAt: string;
    readonly reasonCategory: string;
    readonly reasonCodes: ReadonlyArray<string>;
    readonly reasonMessage: string;
    readonly decisionId?: string;
    readonly requiresAdministrativeAttention?: boolean;
    readonly initialDelaySeconds?: number;
    readonly maxDelaySeconds?: number;
    readonly multiplier?: number;
  }) {
    this.deferred.push(input);
    return Object.freeze({
      changed: true,
      record: Object.freeze({
        runId: input.runId,
        queueId: "queue:default",
        lifecycleState: "queued",
        enteredAt: "2026-04-07T12:00:00.000Z",
        orderKey: "2026-04-07T12:00:00.000Z:run",
        eligibilityMarker: "deferred",
        eligibleAt: "2026-04-07T12:00:30.000Z",
        updatedAt: input.deferredAt,
        revision: 2,
      }),
    });
  }
}

class RecordingPlacementHoldRepository implements IRunNodePlacementHoldRepository {
  public readonly acquisitions: AuthoritativeRunNodePlacementHoldRecord[] = [];
  public readonly releases: Array<{ readonly nodeId: string; readonly holdToken: string; readonly releasedAt: string }> = [];
  public nextAcquireResult: AuthoritativeRunNodePlacementHoldResult | undefined;

  public async acquireNodePlacementHold(input: {
    readonly holdToken: string;
    readonly runId: string;
    readonly queueId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly decisionId?: string;
    readonly heldAt: string;
    readonly expiresAt: string;
  }): Promise<AuthoritativeRunNodePlacementHoldResult> {
    if (this.nextAcquireResult) {
      const output = this.nextAcquireResult;
      this.nextAcquireResult = undefined;
      return output;
    }

    const hold = Object.freeze({
      holdToken: input.holdToken,
      runId: input.runId,
      queueId: input.queueId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      decisionId: input.decisionId,
      heldAt: input.heldAt,
      expiresAt: input.expiresAt,
    });
    this.acquisitions.push(hold);
    return Object.freeze({
      outcome: "acquired",
      hold,
    });
  }

  public async releaseNodePlacementHold(input: {
    readonly nodeId: string;
    readonly holdToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    this.releases.push(input);
    return true;
  }
}

class RecordingGovernanceEventSink implements ISchedulingGovernanceEventSink {
  public readonly events: SchedulingGovernanceEvent[] = [];

  public async recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void> {
    this.events.push(event);
  }
}

function createDecisionBundle(): SchedulingDecisionBundle {
  const snapshot = Object.freeze({
    asOf: "2026-04-07T12:05:00.000Z",
    queueLeases: Object.freeze([Object.freeze({
      runId: "run:1",
      queueId: "queue:default",
      enteredAt: "2026-04-07T12:00:00.000Z",
      eligibleAt: "2026-04-07T12:00:00.000Z",
      claimToken: "claim:1",
      claimOwner: "scheduler:alpha",
      claimExpiresAt: "2026-04-07T12:06:00.000Z",
    })]),
    runs: Object.freeze([]),
    nodes: Object.freeze([]),
  });
  const decision = createSchedulingPolicyDecision({
    decisionId: "decision:1",
    occurredAt: "2026-04-07T12:05:00.000Z",
    outcome: SchedulingDecisionOutcomes.assignmentRecommended,
    selected: Object.freeze({
      runId: "run:1",
      nodeId: "node:1",
      claimToken: "claim:1",
      reservationOwner: "scheduler:alpha",
    }),
    evaluatedCandidates: [],
    policySources: [SchedulingPolicySourceKinds.activeReservations],
  });

  return createSchedulingDecisionBundle({
    snapshot,
    decision,
    assignmentIntents: Object.freeze([Object.freeze({
      runId: "run:1",
      nodeId: "node:1",
      queueId: "queue:default",
      claimToken: "claim:1",
      reservationOwner: "scheduler:alpha",
      decisionId: "decision:1",
      decidedAt: "2026-04-07T12:05:00.000Z",
    })]),
  });
}

function createNoPlacementDecisionBundle(): SchedulingDecisionBundle {
  const snapshot = Object.freeze({
    asOf: "2026-04-07T12:05:00.000Z",
    queueLeases: Object.freeze([Object.freeze({
      runId: "run:2",
      queueId: "queue:default",
      enteredAt: "2026-04-07T12:00:00.000Z",
      eligibleAt: "2026-04-07T12:00:00.000Z",
      claimToken: "claim:2",
      claimOwner: "scheduler:alpha",
      claimExpiresAt: "2026-04-07T12:06:00.000Z",
    })]),
    runs: Object.freeze([]),
    nodes: Object.freeze([]),
  });
  const decision = createSchedulingPolicyDecision({
    decisionId: "decision:no-placement",
    occurredAt: "2026-04-07T12:05:00.000Z",
    outcome: SchedulingDecisionOutcomes.noPlacement,
    selected: undefined,
    evaluatedCandidates: Object.freeze([]),
    reasons: Object.freeze([
      createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.noPlacement,
        "Queued runs could not be evaluated against any eligible nodes.",
      ),
    ]),
    policySources: [SchedulingPolicySourceKinds.activeReservations],
  });

  return createSchedulingDecisionBundle({
    snapshot,
    decision,
    assignmentIntents: Object.freeze([]),
  });
}

describe("MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase", () => {
  it("acquires and releases node placement holds while materializing selected assignment intent", async () => {
    const queueRepository = new RecordingQueueRepository();
    const placementHoldRepository = new RecordingPlacementHoldRepository();
    const governanceSink = new RecordingGovernanceEventSink();
    const claimed: string[] = [];

    const useCase = new MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase({
      queueRepository,
      placementHoldRepository,
      governanceEventSink: governanceSink,
      claimRunForNodeDispatchPreparationUseCase: {
        execute: async (input) => {
          claimed.push(`${input.runId}:${input.nodeId}:${input.claimToken}`);
          return Promise.resolve(undefined as never);
        },
      },
      now: () => new Date("2026-04-07T12:05:00.000Z"),
      idGenerator: {
        nextId: () => "node-hold:1",
      },
      placementHoldTtlSeconds: 45,
    });

    const result = await useCase.materializeAssignmentIntents({
      decisionBundle: createDecisionBundle(),
    });

    expect(result).toHaveLength(1);
    expect(claimed).toEqual(["run:1:node:1:claim:1"]);
    expect(placementHoldRepository.acquisitions).toHaveLength(1);
    expect(placementHoldRepository.acquisitions[0]?.expiresAt).toBe("2026-04-07T12:05:45.000Z");
    expect(placementHoldRepository.releases).toHaveLength(1);
    expect(placementHoldRepository.releases[0]?.holdToken).toBe("node-hold:1");
    expect(queueRepository.releases).toHaveLength(0);
    expect(governanceSink.events).toHaveLength(2);
    expect(governanceSink.events.every((event) => event.type === "scheduling-assignment-materialized")).toBeTrue();
  });

  it("releases queue claim and skips claim materialization when node hold acquisition conflicts", async () => {
    const queueRepository = new RecordingQueueRepository();
    const placementHoldRepository = new RecordingPlacementHoldRepository();
    const governanceSink = new RecordingGovernanceEventSink();
    const claimed: string[] = [];
    placementHoldRepository.nextAcquireResult = Object.freeze({
      outcome: "conflict",
      conflict: Object.freeze({
        reason: "held-by-another-owner",
        nodeId: "node:1",
        message: "held",
        currentHold: Object.freeze({
          holdToken: "hold:existing",
          runId: "run:existing",
          queueId: "queue:default",
          nodeId: "node:1",
          reservationOwner: "scheduler:beta",
          claimToken: "claim:existing",
          heldAt: "2026-04-07T12:04:00.000Z",
          expiresAt: "2026-04-07T12:05:30.000Z",
        }),
      }),
    });

    const useCase = new MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase({
      queueRepository,
      placementHoldRepository,
      governanceEventSink: governanceSink,
      claimRunForNodeDispatchPreparationUseCase: {
        execute: async (input) => {
          claimed.push(`${input.runId}:${input.nodeId}`);
          return Promise.resolve(undefined as never);
        },
      },
      now: () => new Date("2026-04-07T12:05:00.000Z"),
      idGenerator: {
        nextId: () => "node-hold:new",
      },
    });

    const result = await useCase.materializeAssignmentIntents({
      decisionBundle: createDecisionBundle(),
    });

    expect(result).toHaveLength(0);
    expect(claimed).toHaveLength(0);
    expect(queueRepository.releases).toHaveLength(1);
    expect(queueRepository.releases[0]?.runId).toBe("run:1");
    expect(placementHoldRepository.releases).toHaveLength(0);
    expect(governanceSink.events).toHaveLength(2);
    expect(governanceSink.events.every((event) => event.type === "scheduling-reservation-conflict")).toBeTrue();
    expect(governanceSink.events.map((event) => event.channel).sort()).toEqual(["audit", "operational"]);
  });

  it("releases node hold even when claim use case reports a reservation conflict", async () => {
    const queueRepository = new RecordingQueueRepository();
    const placementHoldRepository = new RecordingPlacementHoldRepository();
    const useCase = new MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase({
      queueRepository,
      placementHoldRepository,
      claimRunForNodeDispatchPreparationUseCase: {
        execute: async () => {
          throw new RunNodeDispatchClaimConflictError(Object.freeze({
            reason: RunNodeClaimConflictReasons.reservationConflict,
            runId: "run:1",
            nodeId: "node:1",
            message: "reservation mismatch",
          }));
        },
      },
      now: () => new Date("2026-04-07T12:05:00.000Z"),
      idGenerator: {
        nextId: () => "node-hold:2",
      },
    });

    const result = await useCase.materializeAssignmentIntents({
      decisionBundle: createDecisionBundle(),
    });

    expect(result).toHaveLength(0);
    expect(placementHoldRepository.releases).toHaveLength(1);
    expect(placementHoldRepository.releases[0]?.holdToken).toBe("node-hold:2");
  });

  it("defers non-selected queue leases with no-placement metadata instead of immediate release", async () => {
    const queueRepository = new RecordingQueueRepository();
    const placementHoldRepository = new RecordingPlacementHoldRepository();
    const governanceSink = new RecordingGovernanceEventSink();
    const useCase = new MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase({
      queueRepository,
      placementHoldRepository,
      governanceEventSink: governanceSink,
      claimRunForNodeDispatchPreparationUseCase: {
        execute: async () => Promise.resolve(undefined as never),
      },
      now: () => new Date("2026-04-07T12:05:00.000Z"),
    });

    const result = await useCase.materializeAssignmentIntents({
      decisionBundle: createNoPlacementDecisionBundle(),
    });

    expect(result).toEqual([]);
    expect(queueRepository.releases).toEqual([]);
    expect(queueRepository.deferred).toHaveLength(1);
    expect(queueRepository.deferred[0]?.runId).toBe("run:2");
    expect(queueRepository.deferred[0]?.reasonCodes).toContain("no-placement");
    expect(governanceSink.events).toHaveLength(2);
    expect(governanceSink.events.every((event) => event.type === "scheduling-deferred-no-placement")).toBeTrue();
    expect(governanceSink.events[0]?.runId).toBe("run:2");
  });
});
