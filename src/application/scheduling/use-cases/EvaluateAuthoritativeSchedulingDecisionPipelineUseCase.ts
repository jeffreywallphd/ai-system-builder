import type {
  IAuthoritativeSchedulingDecisionPipeline,
  IAuthoritativeSchedulingInputAssembler,
  IAuthoritativeSchedulingPolicyEvaluator,
  SchedulingDecisionBundle,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";

interface EvaluateAuthoritativeSchedulingDecisionPipelineUseCaseDependencies {
  readonly inputAssembler: IAuthoritativeSchedulingInputAssembler;
  readonly policyEvaluator: IAuthoritativeSchedulingPolicyEvaluator;
  readonly now?: () => Date;
}

const DefaultLimit = 10;

export class EvaluateAuthoritativeSchedulingDecisionPipelineUseCase
  implements IAuthoritativeSchedulingDecisionPipeline {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: EvaluateAuthoritativeSchedulingDecisionPipelineUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async evaluateNextAssignments(input: {
    readonly asOf?: string;
    readonly reservationOwner: string;
    readonly limit?: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly nodeScope?: ReadonlyArray<string>;
  }): Promise<SchedulingDecisionBundle> {
    const asOf = normalizeOptional(input.asOf) ?? this.now().toISOString();
    const snapshot = await this.dependencies.inputAssembler.assemble({
      asOf,
      reservationOwner: normalizeRequired(input.reservationOwner, "reservationOwner"),
      limit: normalizePositiveInteger(input.limit, DefaultLimit),
      queueId: normalizeOptional(input.queueId),
      workspaceId: normalizeOptional(input.workspaceId),
      nodeScope: normalizeNodeScope(input.nodeScope),
    });

    return this.dependencies.policyEvaluator.evaluate(snapshot);
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    throw new Error(`Scheduling decision pipeline requires non-empty ${field}.`);
  }
  return normalized;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return fallback;
  }
  return value as number;
}

function normalizeNodeScope(nodeScope?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!nodeScope || nodeScope.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(nodeScope.map((nodeId) => nodeId.trim()).filter((nodeId) => nodeId.length > 0))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}
