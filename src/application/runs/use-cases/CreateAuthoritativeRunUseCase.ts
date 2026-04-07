import { randomUUID } from "node:crypto";
import {
  PlatformAuditEventKinds,
  type PlatformAuditEventRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import type {
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { toRunDetail, type RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { CanonicalRunSubmissionCommand } from "./RunSubmissionValidationContracts";
import {
  createInitialCanonicalRunRecord,
  mapCanonicalRunToPlatformRecord,
  mapPlatformRunRecordToCanonicalRun,
} from "./RunCreationPersistenceMapper";

export interface CreateAuthoritativeRunRequest {
  readonly command: CanonicalRunSubmissionCommand;
  readonly runId?: string;
  readonly queueId?: string;
}

export interface CreateAuthoritativeRunResult {
  readonly run: RunDetail;
  readonly persistedRunRevision: number;
  readonly orchestrationIntentEventId: string;
}

interface CreateAuthoritativeRunUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveActorId(command: CanonicalRunSubmissionCommand): string {
  const actorId = normalizeOptional(command.submissionContext.submittedByActorId)
    ?? normalizeOptional(command.actor.actorUserIdentityId)
    ?? normalizeOptional(command.actor.actorServiceId);
  return actorId ?? "system:run-orchestrator";
}

function resolveOperationKey(command: CanonicalRunSubmissionCommand, runId: string): string {
  return normalizeOptional(command.submissionContext.idempotencyKey) ?? `run:create:${runId}`;
}

function resolveIdempotentRunId(command: CanonicalRunSubmissionCommand): string | undefined {
  const key = normalizeOptional(command.submissionContext.idempotencyKey);
  if (!key) {
    return undefined;
  }
  const normalized = key.replace(/[^a-zA-Z0-9:_-]/g, "-");
  return normalized ? `run:${normalized}` : undefined;
}

function resolveQueueId(input: CreateAuthoritativeRunRequest): string {
  const requested = normalizeOptional(input.queueId);
  if (requested) {
    return requested;
  }

  const tagQueue = input.command.tags.find((tag) => tag.startsWith("queue:"));
  if (tagQueue) {
    return tagQueue;
  }
  return "queue:default";
}

export class CreateAuthoritativeRunUseCase {
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };

  public constructor(private readonly dependencies: CreateAuthoritativeRunUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
  }

  public async execute(input: CreateAuthoritativeRunRequest): Promise<CreateAuthoritativeRunResult> {
    const runId = normalizeOptional(input.runId)
      ?? resolveIdempotentRunId(input.command)
      ?? this.idGenerator.nextId("run");
    const queueId = resolveQueueId(input);
    const canonicalRun = createInitialCanonicalRunRecord(input.command, runId);
    const record = mapCanonicalRunToPlatformRecord({
      command: input.command,
      run: canonicalRun,
      queueId,
    });
    const actorId = resolveActorId(input.command);
    const operationKey = resolveOperationKey(input.command, runId);
    const intentEventId = this.idGenerator.nextId("audit");

    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      await this.dependencies.runRepository.createRun(record, {
        operationKey,
        actorId,
        occurredAt: input.command.occurredAt,
        correlationId: normalizeOptional(input.command.submissionContext.correlationId),
      });
      await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(this.createInitialOrchestrationIntentEvent({
        eventId: intentEventId,
        actorId,
        runId,
        queueId,
        command: input.command,
      }), {
        operationKey: `${operationKey}:intent`,
        actorId,
        occurredAt: input.command.occurredAt,
        correlationId: normalizeOptional(input.command.submissionContext.correlationId),
      });
    });

    const persisted = await this.dependencies.runRepository.findRunById(runId);
    if (!persisted) {
      throw new Error(`Run '${runId}' was not found after authoritative persistence.`);
    }

    return Object.freeze({
      run: toRunDetail(mapPlatformRunRecordToCanonicalRun(persisted)),
      persistedRunRevision: persisted.revision,
      orchestrationIntentEventId: intentEventId,
    });
  }

  private createInitialOrchestrationIntentEvent(input: {
    readonly eventId: string;
    readonly actorId: string;
    readonly runId: string;
    readonly queueId: string;
    readonly command: CanonicalRunSubmissionCommand;
  }): PlatformAuditEventRecord {
    return Object.freeze({
      eventId: input.eventId,
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.orchestration-intent.recorded",
      actorId: input.actorId,
      workspaceId: input.command.workspaceId,
      userIdentityId: input.command.actor.actorUserIdentityId,
      targetRef: `run:${input.runId}`,
      outcome: "succeeded",
      occurredAt: input.command.occurredAt,
      correlationId: normalizeOptional(input.command.submissionContext.correlationId),
      details: Object.freeze({
        runId: input.runId,
        queueId: input.queueId,
        intentKind: "queue-admission-requested",
        lifecycleState: "submitted",
      }),
    });
  }
}
