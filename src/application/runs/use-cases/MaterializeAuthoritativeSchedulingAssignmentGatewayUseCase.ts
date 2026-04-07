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
import {
  ClaimRunForNodeDispatchPreparationUseCase,
  RunNodeDispatchClaimConflictError,
} from "./ClaimRunForNodeDispatchPreparationUseCase";

interface MaterializeAuthoritativeSchedulingAssignmentGatewayUseCaseDependencies {
  readonly queueRepository: Pick<IRunOrchestrationQueuePersistenceRepository, "releaseRunClaim">;
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
    const selectedRunIds = new Set(input.decisionBundle.assignmentIntents.map((intent) => intent.runId));
    for (const lease of input.decisionBundle.snapshot.queueLeases) {
      if (selectedRunIds.has(lease.runId)) {
        continue;
      }
      await this.dependencies.queueRepository.releaseRunClaim({
        runId: lease.runId,
        claimToken: lease.claimToken,
        releasedAt: this.now().toISOString(),
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
