import type {
  IAuthoritativeSchedulingDecisionPipeline,
  IAuthoritativeSchedulingInputAssembler,
  IAuthoritativeSchedulingPolicyEvaluator,
  SchedulingDecisionBundle,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type { ISchedulingDecisionOutcomeRecorder } from "@application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts";
import {
  publishSchedulingGovernanceEventBestEffort,
  SchedulingGovernanceEventChannels,
  SchedulingGovernanceEventTypes,
  type ISchedulingGovernanceEventSink,
} from "@application/scheduling/ports/SchedulingGovernanceEventPorts";
import { toSchedulingDecisionOutcomeCaptureRecord } from "./SchedulingDecisionOutcomeCapture";

interface EvaluateAuthoritativeSchedulingDecisionPipelineUseCaseDependencies {
  readonly inputAssembler: IAuthoritativeSchedulingInputAssembler;
  readonly policyEvaluator: IAuthoritativeSchedulingPolicyEvaluator;
  readonly outcomeRecorder?: ISchedulingDecisionOutcomeRecorder;
  readonly governanceEventSink?: ISchedulingGovernanceEventSink;
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

    const decisionBundle = await this.dependencies.policyEvaluator.evaluate(snapshot);
    if (this.dependencies.outcomeRecorder) {
      await this.dependencies.outcomeRecorder.recordDecisionOutcome(
        toSchedulingDecisionOutcomeCaptureRecord({
          bundle: decisionBundle,
          recordedAt: this.now().toISOString(),
        }),
      );
    }
    await this.publishGovernanceEvents({
      decisionBundle,
      reservationOwner: input.reservationOwner,
      requestedWorkspaceId: input.workspaceId,
    });

    return decisionBundle;
  }

  private async publishGovernanceEvents(input: {
    readonly decisionBundle: SchedulingDecisionBundle;
    readonly reservationOwner: string;
    readonly requestedWorkspaceId?: string;
  }): Promise<void> {
    const outcome = input.decisionBundle.decision.outcome;
    const selected = input.decisionBundle.decision.selected;
    const selectedCandidate = selected
      ? input.decisionBundle.decision.evaluatedCandidates.find((candidate) => (
        candidate.runId === selected.runId && candidate.nodeId === selected.nodeId
      ))
      : undefined;
    const workspaceId = selected
      ? resolveRunWorkspaceId(input.decisionBundle, selected.runId) ?? normalizeOptional(input.requestedWorkspaceId)
      : normalizeOptional(input.requestedWorkspaceId);

    if (outcome === "assignment-recommended" && selected) {
      const details = selectedCandidate
        ? Object.freeze({
          priorityBand: selectedCandidate.scorecard.priorityBand,
          rolePriorityScore: selectedCandidate.scorecard.rolePriorityScore,
          queueAgeSeconds: selectedCandidate.scorecard.queueAgeSeconds,
          reasonCodes: input.decisionBundle.evaluation.reasonSummary.decisionReasonCodes,
          policySources: input.decisionBundle.decision.policySources,
        })
        : Object.freeze({
          reasonCodes: input.decisionBundle.evaluation.reasonSummary.decisionReasonCodes,
          policySources: input.decisionBundle.decision.policySources,
        });
      await this.publishEventPair({
        type: SchedulingGovernanceEventTypes.priorityPlacementSelected,
        outcome: "succeeded",
        occurredAt: input.decisionBundle.decision.occurredAt,
        decisionId: input.decisionBundle.decision.decisionId,
        reservationOwner: normalizeOptional(input.reservationOwner),
        actorServiceId: normalizeOptional(input.reservationOwner),
        workspaceId,
        runId: selected.runId,
        nodeId: selected.nodeId,
        queueId: resolveRunQueueId(input.decisionBundle, selected.runId),
        details,
      });
      return;
    }

    if (outcome === "deferred" || outcome === "no-placement") {
      await this.publishEventPair({
        type: SchedulingGovernanceEventTypes.deferredNoPlacement,
        outcome: "deferred",
        occurredAt: input.decisionBundle.decision.occurredAt,
        decisionId: input.decisionBundle.decision.decisionId,
        reservationOwner: normalizeOptional(input.reservationOwner),
        actorServiceId: normalizeOptional(input.reservationOwner),
        workspaceId,
        details: Object.freeze({
          schedulerOutcome: outcome,
          queueLeaseCount: input.decisionBundle.snapshot.queueLeases.length,
          candidateCount: input.decisionBundle.decision.evaluatedCandidates.length,
          reasonCodes: input.decisionBundle.evaluation.reasonSummary.decisionReasonCodes,
          exclusionReasonCodes: input.decisionBundle.evaluation.reasonSummary.exclusionReasonCodes,
        }),
      });
    }
  }

  private async publishEventPair(event: {
    readonly type: typeof SchedulingGovernanceEventTypes[keyof typeof SchedulingGovernanceEventTypes];
    readonly outcome: "succeeded" | "deferred" | "conflict" | "rejected";
    readonly occurredAt: string;
    readonly decisionId?: string;
    readonly reservationOwner?: string;
    readonly actorServiceId?: string;
    readonly workspaceId?: string;
    readonly runId?: string;
    readonly nodeId?: string;
    readonly queueId?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishSchedulingGovernanceEventBestEffort(this.dependencies.governanceEventSink, {
      ...event,
      channel: SchedulingGovernanceEventChannels.audit,
    });
    await publishSchedulingGovernanceEventBestEffort(this.dependencies.governanceEventSink, {
      ...event,
      channel: SchedulingGovernanceEventChannels.operational,
    });
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

function resolveRunWorkspaceId(decisionBundle: SchedulingDecisionBundle, runId: string): string | undefined {
  const run = decisionBundle.snapshot.runs.find((candidate) => candidate.runId === runId);
  return normalizeOptional(run?.workspaceId);
}

function resolveRunQueueId(decisionBundle: SchedulingDecisionBundle, runId: string): string | undefined {
  const queueLease = decisionBundle.snapshot.queueLeases.find((lease) => lease.runId === runId);
  return normalizeOptional(queueLease?.queueId);
}
