import type {
  IAuthoritativeSchedulingAssignmentGateway,
  SchedulingAssignmentIntent,
  SchedulingDecisionBundle,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type { IRunOrchestrationQueuePersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  ClaimRunForNodeDispatchPreparationUseCase,
  RunNodeDispatchClaimConflictError,
} from "./ClaimRunForNodeDispatchPreparationUseCase";

interface MaterializeAuthoritativeSchedulingAssignmentGatewayUseCaseDependencies {
  readonly queueRepository: Pick<IRunOrchestrationQueuePersistenceRepository, "releaseRunClaim">;
  readonly claimRunForNodeDispatchPreparationUseCase: Pick<ClaimRunForNodeDispatchPreparationUseCase, "execute">;
  readonly now?: () => Date;
}

export class MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase implements IAuthoritativeSchedulingAssignmentGateway {
  private readonly now: () => Date;

  public constructor(
    private readonly dependencies: MaterializeAuthoritativeSchedulingAssignmentGatewayUseCaseDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date());
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
        if (error instanceof RunNodeDispatchClaimConflictError) {
          continue;
        }
        throw error;
      }
    }

    return Object.freeze(materialized);
  }
}

