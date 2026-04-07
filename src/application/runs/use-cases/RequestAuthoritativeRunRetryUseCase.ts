import { randomUUID } from "node:crypto";
import type { PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { PlatformAuditEventKinds } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { ValidateRunSubmissionUseCase } from "@application/runs/use-cases/ValidateRunSubmissionUseCase";
import type { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import {
  RunLifecycleStates,
  RunSubmissionSources,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";
import { RunMutationActions, type RunMutationResponse, type RunRetryRequest } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { mapPlatformRunRecordToCanonicalRun, type RunAuthoritativeMetadata } from "./RunCreationPersistenceMapper";
import type { RunSubmissionValidationIssue } from "./RunSubmissionValidationContracts";

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new RunRetryValidationError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toIso(value: string | undefined, fallback: string): string {
  const candidate = normalizeOptional(value) ?? fallback;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    throw new RunRetryValidationError("requestedAt must be an ISO-8601 timestamp.");
  }
  return new Date(parsed).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRunMetadata(metadata: unknown): RunAuthoritativeMetadata | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }
  if (!("submissionSnapshot" in metadata)) {
    return undefined;
  }
  return metadata as RunAuthoritativeMetadata;
}

function resolveWorkflowTemplate(input: { readonly sourceAggregateRef: string }): {
  readonly workflowId?: string;
  readonly templateId?: string;
} {
  const normalized = input.sourceAggregateRef.trim();
  if (normalized.startsWith("workflow:")) {
    const workflowId = normalized.slice("workflow:".length).trim();
    return Object.freeze({
      workflowId: workflowId || undefined,
    });
  }
  if (normalized.startsWith("template:")) {
    const templateId = normalized.slice("template:".length).trim();
    return Object.freeze({
      templateId: templateId || undefined,
    });
  }
  return Object.freeze({});
}

export class RunRetryValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RunRetryValidationError";
  }
}

export class RunRetryNotFoundError extends Error {
  public constructor(runId: string) {
    super(`Run '${runId}' was not found.`);
    this.name = "RunRetryNotFoundError";
  }
}

export class RunRetryIneligibleError extends Error {
  public readonly reason:
    | "state-not-eligible"
    | "missing-submission-snapshot";

  public readonly currentState?: RunLifecycleState;

  public constructor(input: {
    readonly reason: "state-not-eligible" | "missing-submission-snapshot";
    readonly runId: string;
    readonly currentState?: RunLifecycleState;
  }) {
    const message = input.reason === "state-not-eligible"
      ? `Run '${input.runId}' is not retry-eligible from lifecycle state '${input.currentState ?? "unknown"}'. Eligible states: failed, cancelled.`
      : `Run '${input.runId}' cannot be retried because authoritative submission snapshot metadata is unavailable.`;
    super(message);
    this.name = "RunRetryIneligibleError";
    this.reason = input.reason;
    this.currentState = input.currentState;
  }
}

export class RunRetrySubmissionValidationError extends Error {
  public readonly code: string;
  public readonly issues: ReadonlyArray<RunSubmissionValidationIssue>;

  public constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly issues: ReadonlyArray<RunSubmissionValidationIssue>;
  }) {
    super(input.message);
    this.name = "RunRetrySubmissionValidationError";
    this.code = input.code;
    this.issues = input.issues;
  }
}

export interface RequestAuthoritativeRunRetry {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly request: RunRetryRequest;
  readonly correlationId?: string;
}

export interface RequestAuthoritativeRunRetryResult {
  readonly mutation: RunMutationResponse;
  readonly sourceRunId: string;
  readonly retriedRunId: string;
}

interface RequestAuthoritativeRunRetryUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly validateRunSubmissionUseCase: ValidateRunSubmissionUseCase;
  readonly createAuthoritativeRunUseCase: CreateAuthoritativeRunUseCase;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

export class RequestAuthoritativeRunRetryUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };

  public constructor(private readonly dependencies: RequestAuthoritativeRunRetryUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
  }

  public async execute(input: RequestAuthoritativeRunRetry): Promise<RequestAuthoritativeRunRetryResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const runId = normalizeRequired(input.request.runId, "runId");
    const requestedAt = toIso(input.request.requestedAt, this.now().toISOString());
    const reason = normalizeOptional(input.request.reason);

    const persisted = await this.dependencies.runRepository.findRunById(runId);
    if (!persisted || persisted.workspaceId !== workspaceId) {
      throw new RunRetryNotFoundError(runId);
    }

    const metadata = resolveRunMetadata(persisted.metadata);
    const snapshot = metadata?.submissionSnapshot;
    if (!snapshot) {
      throw new RunRetryIneligibleError({
        reason: "missing-submission-snapshot",
        runId,
      });
    }

    const sourceRun = mapPlatformRunRecordToCanonicalRun(persisted);
    if (sourceRun.state !== RunLifecycleStates.failed && sourceRun.state !== RunLifecycleStates.cancelled) {
      throw new RunRetryIneligibleError({
        reason: "state-not-eligible",
        runId,
        currentState: sourceRun.state,
      });
    }

    const sourceBinding = resolveWorkflowTemplate({
      sourceAggregateRef: persisted.sourceAggregateRef,
    });
    const retryMetadata = Object.freeze({
      ...(snapshot.metadata ?? {}),
      retry: Object.freeze({
        previousRunId: runId,
        reason,
        requestedByActorId: actorUserIdentityId,
        requestedAt,
      }),
    });

    const validation = await this.dependencies.validateRunSubmissionUseCase.execute({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: workspaceId,
      }),
      submission: Object.freeze({
        workspaceId,
        workflowId: sourceBinding.workflowId,
        templateId: sourceBinding.templateId,
        source: RunSubmissionSources.uiRerun,
        submittedByActorId: actorUserIdentityId,
        correlationId: normalizeOptional(input.correlationId),
        idempotencyKey: normalizeOptional(input.request.idempotencyKey),
        runtimeTarget: snapshot.runtimeTarget,
        tags: snapshot.tags,
        metadata: retryMetadata,
        parameters: snapshot.parameters,
        storageReferences: snapshot.storageReferences,
        resourceReferences: snapshot.resourceReferences,
        policyPrerequisites: snapshot.policyPrerequisites,
      }),
      occurredAt: requestedAt,
    });

    if (!validation.ok) {
      throw new RunRetrySubmissionValidationError({
        code: validation.error.code,
        message: validation.error.message,
        issues: validation.error.validationIssues,
      });
    }

    const nextAttempt = sourceRun.retry.attempt + 1;
    const nextMaxAttempts = Math.max(sourceRun.retry.maxAttempts, nextAttempt);

    const created = await this.dependencies.createAuthoritativeRunUseCase.execute({
      command: validation.command,
      retry: Object.freeze({
        attempt: nextAttempt,
        maxAttempts: nextMaxAttempts,
        previousRunId: runId,
        retryReason: reason,
      }),
    });

    await this.appendRetryAuditEvent({
      sourceRunId: runId,
      retriedRunId: created.run.runId,
      workspaceId,
      actorUserIdentityId,
      requestedAt,
      reason,
      fromState: sourceRun.state,
      nextAttempt,
      nextMaxAttempts,
      correlationId: normalizeOptional(input.correlationId),
      idempotencyKey: normalizeOptional(input.request.idempotencyKey),
    });

    return Object.freeze({
      mutation: Object.freeze({
        action: RunMutationActions.retry,
        run: created.run,
        mutation: Object.freeze({
          changed: true,
          mutationId: created.orchestrationIntentEventId,
          occurredAt: validation.command.occurredAt,
        }),
      }),
      sourceRunId: runId,
      retriedRunId: created.run.runId,
    });
  }

  private async appendRetryAuditEvent(input: {
    readonly sourceRunId: string;
    readonly retriedRunId: string;
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly requestedAt: string;
    readonly reason?: string;
    readonly fromState: RunLifecycleState;
    readonly nextAttempt: number;
    readonly nextMaxAttempts: number;
    readonly correlationId?: string;
    readonly idempotencyKey?: string;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.retry.requested",
      actorId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      userIdentityId: input.actorUserIdentityId,
      targetRef: `run:${input.sourceRunId}`,
      outcome: "succeeded",
      occurredAt: input.requestedAt,
      correlationId: input.correlationId,
      details: Object.freeze({
        sourceRunId: input.sourceRunId,
        retriedRunId: input.retriedRunId,
        fromState: input.fromState,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        lineage: Object.freeze({
          kind: "retry",
          previousRunId: input.sourceRunId,
          attempt: input.nextAttempt,
          maxAttempts: input.nextMaxAttempts,
          retryReason: input.reason,
        }),
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:retry-audit:${input.sourceRunId}:${event.eventId}`,
      actorId: input.actorUserIdentityId,
      occurredAt: input.requestedAt,
      correlationId: input.correlationId,
    });
  }
}
