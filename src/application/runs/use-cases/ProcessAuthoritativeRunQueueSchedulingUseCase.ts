import type {
  IAuthoritativeSchedulingAssignmentGateway,
  IAuthoritativeSchedulingDecisionPipeline,
  SchedulingAssignmentIntent,
  SchedulingDecisionBundle,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";

export interface ProcessAuthoritativeRunQueueSchedulingRequest {
  readonly reservationOwner: string;
  readonly asOf?: string;
  readonly queueId?: string;
  readonly workspaceId?: string;
  readonly limit?: number;
  readonly nodeScope?: ReadonlyArray<string>;
}

export interface ProcessAuthoritativeRunQueueSchedulingResult {
  readonly decisionBundle: SchedulingDecisionBundle;
  readonly materializedAssignmentIntents: ReadonlyArray<SchedulingAssignmentIntent>;
}

interface ProcessAuthoritativeRunQueueSchedulingUseCaseDependencies {
  readonly schedulingDecisionPipeline: IAuthoritativeSchedulingDecisionPipeline;
  readonly schedulingAssignmentGateway: IAuthoritativeSchedulingAssignmentGateway;
}

export class ProcessAuthoritativeRunQueueSchedulingUseCase {
  public constructor(private readonly dependencies: ProcessAuthoritativeRunQueueSchedulingUseCaseDependencies) {}

  public async execute(
    input: ProcessAuthoritativeRunQueueSchedulingRequest,
  ): Promise<ProcessAuthoritativeRunQueueSchedulingResult> {
    const decisionBundle = await this.dependencies.schedulingDecisionPipeline.evaluateNextAssignments({
      asOf: input.asOf,
      reservationOwner: input.reservationOwner,
      limit: input.limit,
      queueId: input.queueId,
      workspaceId: input.workspaceId,
      nodeScope: input.nodeScope,
    });

    const materializedAssignmentIntents = await this.dependencies.schedulingAssignmentGateway.materializeAssignmentIntents({
      decisionBundle,
    });

    return Object.freeze({
      decisionBundle,
      materializedAssignmentIntents,
    });
  }
}

