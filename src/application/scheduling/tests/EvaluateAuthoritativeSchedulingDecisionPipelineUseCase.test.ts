import { describe, expect, it } from "bun:test";
import type {
  IAuthoritativeSchedulingInputAssembler,
  IAuthoritativeSchedulingPolicyEvaluator,
  SchedulingEvaluationSnapshot,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type {
  ISchedulingDecisionOutcomeRecorder,
  SchedulingDecisionOutcomeCaptureRecord,
} from "@application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts";
import type {
  ISchedulingGovernanceEventSink,
  SchedulingGovernanceEvent,
} from "@application/scheduling/ports/SchedulingGovernanceEventPorts";
import {
  createSchedulingDecisionBundle,
  createSchedulingOutcomeReason,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";
import {
  SchedulingDecisionOutcomes,
  SchedulingPolicySourceKinds,
  createSchedulingPolicyDecision,
} from "@domain/scheduling/SchedulingDomain";
import { EvaluateAuthoritativeSchedulingDecisionPipelineUseCase } from "../use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase";

class RecordingInputAssembler implements IAuthoritativeSchedulingInputAssembler {
  public lastInput:
    | {
      readonly asOf: string;
      readonly reservationOwner: string;
      readonly limit: number;
      readonly queueId?: string;
      readonly workspaceId?: string;
      readonly nodeScope?: ReadonlyArray<string>;
    }
    | undefined;

  public constructor(private readonly snapshot: SchedulingEvaluationSnapshot) {}

  public async assemble(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly nodeScope?: ReadonlyArray<string>;
  }): Promise<SchedulingEvaluationSnapshot> {
    this.lastInput = input;
    return this.snapshot;
  }
}

class RecordingPolicyEvaluator implements IAuthoritativeSchedulingPolicyEvaluator {
  public lastSnapshot: SchedulingEvaluationSnapshot | undefined;

  public async evaluate(snapshot: SchedulingEvaluationSnapshot) {
    this.lastSnapshot = snapshot;

    const decision = createSchedulingPolicyDecision({
      decisionId: "decision:pipeline",
      occurredAt: "2026-04-07T21:00:00.000Z",
      outcome: SchedulingDecisionOutcomes.deferred,
      evaluatedCandidates: [],
      reasons: [createSchedulingOutcomeReason("queue-empty", "Queue is empty.")],
      policySources: [SchedulingPolicySourceKinds.runSubmission],
    });

    return createSchedulingDecisionBundle({
      snapshot,
      decision,
      assignmentIntents: [],
    });
  }
}

class PlacementPolicyEvaluator implements IAuthoritativeSchedulingPolicyEvaluator {
  public async evaluate(snapshot: SchedulingEvaluationSnapshot) {
    const decision = createSchedulingPolicyDecision({
      decisionId: "decision:placement",
      occurredAt: "2026-04-07T21:00:00.000Z",
      outcome: SchedulingDecisionOutcomes.assignmentRecommended,
      selected: Object.freeze({
        runId: "run:1",
        nodeId: "node:1",
        claimToken: "claim:1",
        reservationOwner: "scheduler:alpha",
      }),
      evaluatedCandidates: Object.freeze([Object.freeze({
        runId: "run:1",
        nodeId: "node:1",
        eligible: true,
        denialReasons: Object.freeze([]),
        scorecard: Object.freeze({
          priorityBand: "critical",
          rolePriorityScore: 4,
          queueAgeSeconds: 120,
        }),
      })]),
      reasons: [createSchedulingOutcomeReason("role-priority-preempted", "Selected by role priority.")],
      policySources: [SchedulingPolicySourceKinds.workspaceMembershipRoles],
    });
    return createSchedulingDecisionBundle({
      snapshot,
      decision,
      assignmentIntents: Object.freeze([]),
    });
  }
}

class RecordingOutcomeRecorder implements ISchedulingDecisionOutcomeRecorder {
  public recorded: SchedulingDecisionOutcomeCaptureRecord[] = [];

  public async recordDecisionOutcome(record: SchedulingDecisionOutcomeCaptureRecord): Promise<void> {
    this.recorded.push(record);
  }
}

class RecordingGovernanceEventSink implements ISchedulingGovernanceEventSink {
  public readonly events: SchedulingGovernanceEvent[] = [];

  public async recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("EvaluateAuthoritativeSchedulingDecisionPipelineUseCase", () => {
  it("assembles inputs and delegates policy evaluation with normalized pipeline arguments", async () => {
    const snapshot: SchedulingEvaluationSnapshot = Object.freeze({
      asOf: "2026-04-07T21:00:00.000Z",
      queueLeases: [],
      runs: [],
      nodes: [],
    });
    const assembler = new RecordingInputAssembler(snapshot);
    const evaluator = new RecordingPolicyEvaluator();
    const useCase = new EvaluateAuthoritativeSchedulingDecisionPipelineUseCase({
      inputAssembler: assembler,
      policyEvaluator: evaluator,
      now: () => new Date("2026-04-07T21:00:00.000Z"),
    });

    const result = await useCase.evaluateNextAssignments({
      reservationOwner: " scheduler:alpha ",
      limit: 0,
      queueId: " queue:default ",
      workspaceId: " workspace:1 ",
      nodeScope: [" node:1 ", "node:1", " ", "node:2"],
    });

    expect(assembler.lastInput).toEqual(Object.freeze({
      asOf: "2026-04-07T21:00:00.000Z",
      reservationOwner: "scheduler:alpha",
      limit: 10,
      queueId: "queue:default",
      workspaceId: "workspace:1",
      nodeScope: Object.freeze(["node:1", "node:2"]),
    }));
    expect(evaluator.lastSnapshot).toEqual(snapshot);
    expect(result.decision.decisionId).toBe("decision:pipeline");
    expect(result.decision.outcome).toBe("deferred");
  });

  it("throws when reservation owner is empty", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingDecisionPipelineUseCase({
      inputAssembler: new RecordingInputAssembler(Object.freeze({
        asOf: "2026-04-07T21:00:00.000Z",
        queueLeases: [],
        runs: [],
        nodes: [],
      })),
      policyEvaluator: new RecordingPolicyEvaluator(),
    });

    await expect(useCase.evaluateNextAssignments({
      reservationOwner: "  ",
    })).rejects.toThrow("reservationOwner");
  });

  it("records scheduling outcome captures for admin/audit projections when recorder is configured", async () => {
    const snapshot: SchedulingEvaluationSnapshot = Object.freeze({
      asOf: "2026-04-07T21:00:00.000Z",
      queueLeases: [],
      runs: [],
      nodes: [],
    });
    const recorder = new RecordingOutcomeRecorder();
    const useCase = new EvaluateAuthoritativeSchedulingDecisionPipelineUseCase({
      inputAssembler: new RecordingInputAssembler(snapshot),
      policyEvaluator: new RecordingPolicyEvaluator(),
      outcomeRecorder: recorder,
      now: () => new Date("2026-04-07T21:05:00.000Z"),
    });

    await useCase.evaluateNextAssignments({
      reservationOwner: "scheduler:alpha",
    });

    expect(recorder.recorded).toHaveLength(1);
    expect(recorder.recorded[0]).toEqual(Object.freeze({
      decisionId: "decision:pipeline",
      occurredAt: "2026-04-07T21:00:00.000Z",
      recordedAt: "2026-04-07T21:05:00.000Z",
      outcome: "deferred",
      selected: undefined,
      summary: Object.freeze({
        queueLeaseCount: 0,
        runCount: 0,
        nodeCount: 0,
        candidateCount: 0,
        eligibleCandidateCount: 0,
        excludedCandidateCount: 0,
      }),
      reasonSummary: Object.freeze({
        decisionReasonCodes: Object.freeze(["queue-empty"]),
        decisionReasonCatalog: Object.freeze([Object.freeze({
          code: "queue-empty",
          count: 1,
          sampleMessage: "Queue is empty.",
        })]),
        exclusionReasonCodes: Object.freeze([]),
        exclusionReasonCatalog: Object.freeze([]),
        exclusionSamples: Object.freeze([]),
      }),
    }));
  });

  it("emits paired audit/operational events for priority-driven placement selections", async () => {
    const snapshot: SchedulingEvaluationSnapshot = Object.freeze({
      asOf: "2026-04-07T21:00:00.000Z",
      queueLeases: Object.freeze([Object.freeze({
        runId: "run:1",
        queueId: "queue:default",
        enteredAt: "2026-04-07T20:58:00.000Z",
        eligibleAt: "2026-04-07T20:58:00.000Z",
        claimToken: "claim:1",
        claimOwner: "scheduler:alpha",
        claimExpiresAt: "2026-04-07T21:02:00.000Z",
      })]),
      runs: Object.freeze([Object.freeze({
        runId: "run:1",
        workspaceId: "workspace-alpha",
        submittedByUserIdentityId: "user:owner",
        workspaceRoleKeys: Object.freeze(["owner"]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([]),
          requiresRemoteScheduling: false,
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T20:58:00.000Z",
          eligibleAt: "2026-04-07T20:58:00.000Z",
          claimToken: "claim:1",
          claimOwner: "scheduler:alpha",
        }),
      })]),
      nodes: Object.freeze([]),
    });
    const governanceSink = new RecordingGovernanceEventSink();
    const useCase = new EvaluateAuthoritativeSchedulingDecisionPipelineUseCase({
      inputAssembler: new RecordingInputAssembler(snapshot),
      policyEvaluator: new PlacementPolicyEvaluator(),
      governanceEventSink: governanceSink,
      now: () => new Date("2026-04-07T21:05:00.000Z"),
    });

    await useCase.evaluateNextAssignments({
      reservationOwner: "scheduler:alpha",
      workspaceId: "workspace-alpha",
    });

    expect(governanceSink.events).toHaveLength(2);
    expect(governanceSink.events.every((event) => event.type === "scheduling-priority-placement-selected")).toBeTrue();
    expect(governanceSink.events.map((event) => event.channel).sort()).toEqual(["audit", "operational"]);
    expect(governanceSink.events[0]?.runId).toBe("run:1");
    expect(governanceSink.events[0]?.nodeId).toBe("node:1");
    expect(governanceSink.events[0]?.workspaceId).toBe("workspace-alpha");
    expect((governanceSink.events[0]?.details as { rolePriorityScore?: number } | undefined)?.rolePriorityScore).toBe(4);
  });
});
