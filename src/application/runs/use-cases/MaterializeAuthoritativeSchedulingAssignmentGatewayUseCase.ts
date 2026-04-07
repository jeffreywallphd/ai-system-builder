import { randomUUID } from "node:crypto";
import type {
  IAuthoritativeSchedulingAssignmentGateway,
  SchedulingAssignmentIntent,
  SchedulingDecisionBundle,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type {
  IRunNodePlacementHoldRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { SchedulingDecisionOutcomes } from "@domain/scheduling/SchedulingDomain";
import { SchedulingPolicyEvaluationReasonCodes } from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";
import {
  ClaimRunForNodeDispatchPreparationUseCase,
  RunNodeDispatchClaimConflictError,
} from "./ClaimRunForNodeDispatchPreparationUseCase";

interface MaterializeAuthoritativeSchedulingAssignmentGatewayUseCaseDependencies {
  readonly queueRepository: Pick<IRunOrchestrationQueuePersistenceRepository, "releaseRunClaim" | "deferRunClaimForNoPlacement">;
  readonly placementHoldRepository: IRunNodePlacementHoldRepository;
  readonly claimRunForNodeDispatchPreparationUseCase: Pick<ClaimRunForNodeDispatchPreparationUseCase, "execute">;
  readonly now?: () => Date;
  readonly placementHoldTtlSeconds?: number;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

export class MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase implements IAuthoritativeSchedulingAssignmentGateway {
  private readonly now: () => Date;
  private readonly placementHoldTtlSeconds: number;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };

  public constructor(
    private readonly dependencies: MaterializeAuthoritativeSchedulingAssignmentGatewayUseCaseDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.placementHoldTtlSeconds = Math.max(1, dependencies.placementHoldTtlSeconds ?? 30);
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
  }

  public async materializeAssignmentIntents(input: {
    readonly decisionBundle: SchedulingDecisionBundle;
  }): Promise<ReadonlyArray<SchedulingAssignmentIntent>> {
    const noPlacementByRunId = toNoPlacementByRunId(input.decisionBundle);
    const selectedRunIds = new Set(input.decisionBundle.assignmentIntents.map((intent) => intent.runId));
    for (const lease of input.decisionBundle.snapshot.queueLeases) {
      if (selectedRunIds.has(lease.runId)) {
        continue;
      }
      const noPlacement = noPlacementByRunId.get(lease.runId);
      if (!noPlacement || !this.dependencies.queueRepository.deferRunClaimForNoPlacement) {
        await this.dependencies.queueRepository.releaseRunClaim({
          runId: lease.runId,
          claimToken: lease.claimToken,
          releasedAt: this.now().toISOString(),
        });
        continue;
      }
      await this.dependencies.queueRepository.deferRunClaimForNoPlacement({
        runId: lease.runId,
        claimToken: lease.claimToken,
        deferredAt: this.now().toISOString(),
        reasonCategory: noPlacement.reasonCategory,
        reasonCodes: noPlacement.reasonCodes,
        reasonMessage: noPlacement.reasonMessage,
        decisionId: input.decisionBundle.decision.decisionId,
        requiresAdministrativeAttention: noPlacement.requiresAdministrativeAttention,
        initialDelaySeconds: noPlacement.backoff.initialDelaySeconds,
        maxDelaySeconds: noPlacement.backoff.maxDelaySeconds,
        multiplier: noPlacement.backoff.multiplier,
      });
    }

    const materialized: SchedulingAssignmentIntent[] = [];
    for (const intent of input.decisionBundle.assignmentIntents) {
      const holdToken = this.idGenerator.nextId("node-placement-hold");
      const heldAt = this.now().toISOString();
      const expiresAt = new Date(Date.parse(heldAt) + (this.placementHoldTtlSeconds * 1000)).toISOString();
      const hold = await this.dependencies.placementHoldRepository.acquireNodePlacementHold({
        holdToken,
        runId: intent.runId,
        queueId: intent.queueId,
        nodeId: intent.nodeId,
        reservationOwner: intent.reservationOwner,
        claimToken: intent.claimToken,
        decisionId: intent.decisionId,
        heldAt,
        expiresAt,
      });
      if (hold.outcome === "conflict") {
        await this.dependencies.queueRepository.releaseRunClaim({
          runId: intent.runId,
          claimToken: intent.claimToken,
          releasedAt: this.now().toISOString(),
        });
        continue;
      }

      try {
        await this.dependencies.claimRunForNodeDispatchPreparationUseCase.execute({
          runId: intent.runId,
          nodeId: intent.nodeId,
          reservationOwner: intent.reservationOwner,
          claimToken: intent.claimToken,
          preparedAt: intent.decidedAt,
        });
        materialized.push(intent);
      } catch (error) {
        if (!(error instanceof RunNodeDispatchClaimConflictError)) {
          throw error;
        }
      } finally {
        await this.dependencies.placementHoldRepository.releaseNodePlacementHold({
          nodeId: intent.nodeId,
          holdToken,
          releasedAt: this.now().toISOString(),
        });
      }
    }

    return Object.freeze(materialized);
  }
}

interface NoPlacementBackoffPolicy {
  readonly initialDelaySeconds: number;
  readonly multiplier: number;
  readonly maxDelaySeconds: number;
}

interface NoPlacementDisposition {
  readonly reasonCategory: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly reasonMessage: string;
  readonly requiresAdministrativeAttention: boolean;
  readonly backoff: NoPlacementBackoffPolicy;
}

function toNoPlacementByRunId(decisionBundle: SchedulingDecisionBundle): ReadonlyMap<string, NoPlacementDisposition> {
  const selectedRunIds = new Set(decisionBundle.assignmentIntents.map((intent) => intent.runId));
  const runIds = [...new Set(decisionBundle.snapshot.queueLeases.map((lease) => lease.runId))]
    .filter((runId) => !selectedRunIds.has(runId));
  const result = new Map<string, NoPlacementDisposition>();
  for (const runId of runIds) {
    const runCandidates = decisionBundle.decision.evaluatedCandidates.filter((candidate) => candidate.runId === runId);
    result.set(runId, buildRunNoPlacementDisposition({
      decisionBundle,
      runId,
      runCandidates,
    }));
  }
  return result;
}

function buildRunNoPlacementDisposition(input: {
  readonly decisionBundle: SchedulingDecisionBundle;
  readonly runId: string;
  readonly runCandidates: ReadonlyArray<SchedulingDecisionBundle["decision"]["evaluatedCandidates"][number]>;
}): NoPlacementDisposition {
  if (input.runCandidates.length === 0) {
    return Object.freeze({
      reasonCategory: "missing-run-or-node-candidate",
      reasonCodes: Object.freeze([SchedulingPolicyEvaluationReasonCodes.noPlacement]),
      reasonMessage: `Run '${input.runId}' had no scheduling candidates for the current evaluation.`,
      requiresAdministrativeAttention: true,
      backoff: Object.freeze({
        initialDelaySeconds: 120,
        multiplier: 2,
        maxDelaySeconds: 900,
      }),
    });
  }

  const hasEligibleCandidate = input.runCandidates.some((candidate) => candidate.eligible);
  if (hasEligibleCandidate) {
    return Object.freeze({
      reasonCategory: "role-priority-preempted",
      reasonCodes: Object.freeze([SchedulingPolicyEvaluationReasonCodes.rolePriorityPreempted]),
      reasonMessage: `Run '${input.runId}' was preempted by higher-priority arbitration for this scheduling cycle.`,
      requiresAdministrativeAttention: false,
      backoff: Object.freeze({
        initialDelaySeconds: 5,
        multiplier: 2,
        maxDelaySeconds: 60,
      }),
    });
  }

  const denialCodes = [...new Set(
    input.runCandidates.flatMap((candidate) => candidate.denialReasons.map((reason) => reason.code)),
  )];
  const reasonCodes = denialCodes.length > 0
    ? denialCodes
    : [SchedulingPolicyEvaluationReasonCodes.noEligibleCandidates];
  const adminAttention = denialCodes.includes("node-missing-capability")
    || denialCodes.includes("remote-scheduling-unsupported");
  const reasonCategory = adminAttention
    ? "capability-coverage-missing"
    : "policy-blocked";
  const reasonMessage = adminAttention
    ? `Run '${input.runId}' could not be scheduled because no eligible node satisfies required capabilities.`
    : `Run '${input.runId}' could not be scheduled due to current policy and node availability constraints.`;

  const decisionOutcome = input.decisionBundle.decision.outcome;
  const noPlacementOutcome = decisionOutcome === SchedulingDecisionOutcomes.noPlacement;
  return Object.freeze({
    reasonCategory,
    reasonCodes: Object.freeze(reasonCodes),
    reasonMessage,
    requiresAdministrativeAttention: adminAttention,
    backoff: Object.freeze({
      initialDelaySeconds: noPlacementOutcome ? 30 : 15,
      multiplier: 2,
      maxDelaySeconds: noPlacementOutcome ? 300 : 120,
    }),
  });
}
