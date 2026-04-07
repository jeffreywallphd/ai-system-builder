import { randomUUID } from "node:crypto";
import { SecretAccessActions, SecretScopes } from "@domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
  ISecretReEncryptionOperationRepository,
  SecretReEncryptionFailure,
  SecretReEncryptionOperationRecord,
  SecretReEncryptionTarget,
} from "../ports/SecretServicePorts";
import {
  SecretAuditEventKinds,
  SecretAuditOperationStatuses,
} from "../ports/SecretServicePorts";
import {
  NoOpSecretObservabilityPort,
  SecretOperationalOutcomes,
  type ISecretObservabilityPort,
} from "../ports/SecretObservabilityPorts";
import {
  SecretReEncryptionOperationStatuses,
  SecretServiceErrorCodes,
  type GetSecretReEncryptionStatusRequest,
  type ReEncryptSecretsRequest,
  type ReEncryptSecretsResult,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

const DEFAULT_MAX_TARGETS_PER_INVOCATION = 50;
const MAX_TARGETS_PER_INVOCATION = 500;

export interface ReEncryptSecretsUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretEncryptionPort: ISecretEncryptionPort;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly reEncryptionOperationRepository: ISecretReEncryptionOperationRepository;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class ReEncryptSecretsUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: ReEncryptSecretsUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(request: ReEncryptSecretsRequest): Promise<SecretServiceResult<ReEncryptSecretsResult>> {
    const actorId = normalizeRequired(request.actor?.actorId);
    if (!actorId) {
      return invalidRequest("actor.actorId is required.");
    }

    const operationKey = normalizeRequired(request.operationKey);
    if (!operationKey) {
      return invalidRequest("operationKey is required.");
    }

    const occurredAt = normalizeTimestamp(request.occurredAt, this.now);
    if (!occurredAt) {
      return invalidRequest("occurredAt must be a valid timestamp when provided.");
    }

    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.reEncrypt,
      actor: request.actor,
      owner: Object.freeze({
        scope: SecretScopes.server,
      }),
      occurredAt,
    });
    await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
      eventKind: SecretAuditEventKinds.accessDecision,
      action: SecretAccessActions.reEncrypt,
      decision: decision.allowed ? "allowed" : "denied",
      reason: decision.reason,
      actor: Object.freeze({
        actorId,
        actorType: request.actor.actorType,
        workspaceId: request.actor.workspaceId,
        userIdentityId: request.actor.userIdentityId,
      }),
      target: Object.freeze({
        scope: SecretScopes.server,
      }),
      occurredAt: decision.occurredAt,
    }));
    if (!decision.allowed) {
      await this.emitOperation("denied", actorId, decision.occurredAt, Object.freeze({
        reason: decision.reason,
      }));
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Secret re-encryption access denied (${decision.reason}).`,
        }),
      };
    }

    const maxTargetsPerInvocation = normalizeMaxTargets(request.maxTargetsPerInvocation);
    if (maxTargetsPerInvocation === undefined) {
      return invalidRequest(
        `maxTargetsPerInvocation must be an integer between 1 and ${MAX_TARGETS_PER_INVOCATION}.`,
      );
    }

    try {
      const operation = await this.resolveOperation({
        operationId: normalizeOptional(request.operationId),
        operationKey,
        actorId,
        occurredAt,
      });
      if (!operation.ok) {
        return operation;
      }

      if (operation.value.state === SecretReEncryptionOperationStatuses.succeeded) {
        return {
          ok: true,
          value: toResult(operation.value),
        };
      }

      const processed = await this.processTargets({
        operation: operation.value,
        actorId,
        operationKey,
        occurredAt,
        maxTargetsPerInvocation,
      });
      if (!processed.ok) {
        return processed;
      }

      await this.emitOperation(
        processed.value.status === SecretReEncryptionOperationStatuses.failed ? "failed" : "succeeded",
        actorId,
        occurredAt,
        Object.freeze({
          operationId: processed.value.operationId,
          status: processed.value.status,
          processedTargets: processed.value.processedTargets,
          remainingTargets: processed.value.remainingTargets,
        }),
      );

      return {
        ok: true,
        value: processed.value,
      };
    } catch {
      await this.emitOperation("failed", actorId, occurredAt, Object.freeze({
        reason: "internal-error",
      }));
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.internal,
          message: "Secret re-encryption failed due to an internal security error.",
        }),
      };
    }
  }

  public async getStatus(
    request: GetSecretReEncryptionStatusRequest,
  ): Promise<SecretServiceResult<ReEncryptSecretsResult>> {
    const actorId = normalizeRequired(request.actor?.actorId);
    if (!actorId) {
      return invalidRequest("actor.actorId is required.");
    }

    const operationId = normalizeRequired(request.operationId);
    if (!operationId) {
      return invalidRequest("operationId is required.");
    }

    const occurredAt = normalizeTimestamp(request.occurredAt, this.now);
    if (!occurredAt) {
      return invalidRequest("occurredAt must be a valid timestamp when provided.");
    }

    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.reEncrypt,
      actor: request.actor,
      owner: Object.freeze({
        scope: SecretScopes.server,
      }),
      occurredAt,
    });
    if (!decision.allowed) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Secret re-encryption access denied (${decision.reason}).`,
        }),
      };
    }

    const operation = await this.dependencies.reEncryptionOperationRepository.findReEncryptionOperationById(operationId);
    if (!operation) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.notFound,
          message: `Secret re-encryption operation '${operationId}' was not found.`,
        }),
      };
    }

    return {
      ok: true,
      value: toResult(operation),
    };
  }

  private async resolveOperation(input: {
    readonly operationId?: string;
    readonly operationKey: string;
    readonly actorId: string;
    readonly occurredAt: string;
  }): Promise<SecretServiceResult<SecretReEncryptionOperationRecord>> {
    if (input.operationId) {
      const operation = await this.dependencies.reEncryptionOperationRepository.findReEncryptionOperationById(input.operationId);
      if (!operation) {
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.notFound,
            message: `Secret re-encryption operation '${input.operationId}' was not found.`,
          }),
        };
      }

      if (operation.operationKey !== input.operationKey) {
        return invalidRequest("operationKey does not match the requested operationId.");
      }

      return {
        ok: true,
        value: operation,
      };
    }

    const replay = await this.dependencies.reEncryptionOperationRepository.findReEncryptionOperationByOperationKey(
      input.operationKey,
    );
    if (replay) {
      return {
        ok: true,
        value: replay,
      };
    }

    const activeOperation = await this.dependencies.reEncryptionOperationRepository.findLatestRunningReEncryptionOperation();
    if (activeOperation) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.conflict,
          message: `Secret re-encryption operation '${activeOperation.operationId}' is already running.`,
        }),
      };
    }

    const targets = await this.collectTargets();
    const created = await this.dependencies.reEncryptionOperationRepository.createReEncryptionOperation(Object.freeze({
      operationId: `secret-reencrypt:${randomUUID()}`,
      operationKey: input.operationKey,
      state: SecretReEncryptionOperationStatuses.running,
      targets,
      currentIndex: 0,
      succeededCount: 0,
      failedCount: 0,
      failures: Object.freeze([]),
      startedBy: input.actorId,
      startedAt: input.occurredAt,
      updatedAt: input.occurredAt,
      completedAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
    }));

    return {
      ok: true,
      value: created,
    };
  }

  private async collectTargets(): Promise<ReadonlyArray<SecretReEncryptionTarget>> {
    const references = await this.dependencies.secretRecordRepository.listSecrets({
      includeDisabled: true,
      includeArchived: true,
      includeSoftDeleted: true,
      limit: 10_000,
      offset: 0,
    });

    const targets: SecretReEncryptionTarget[] = [];
    for (const reference of references) {
      const record = await this.dependencies.secretRecordRepository.findSecretById(reference.secretId);
      if (!record?.currentVersionId) {
        continue;
      }

      const activeVersion = record.versions.find(
        (version) => version.versionId === record.currentVersionId && version.state === "active",
      );
      if (!activeVersion) {
        continue;
      }

      targets.push(Object.freeze({
        secretId: record.secretId,
        versionId: activeVersion.versionId,
      }));
    }

    return Object.freeze(targets);
  }

  private async processTargets(input: {
    readonly operation: SecretReEncryptionOperationRecord;
    readonly actorId: string;
    readonly operationKey: string;
    readonly occurredAt: string;
    readonly maxTargetsPerInvocation: number;
  }): Promise<SecretServiceResult<ReEncryptSecretsResult>> {
    let operation = input.operation;
    if (operation.state === SecretReEncryptionOperationStatuses.failed) {
      const resumed = Object.freeze({
        ...operation,
        state: SecretReEncryptionOperationStatuses.running,
        updatedAt: input.occurredAt,
        completedAt: undefined,
        lastErrorCode: undefined,
        lastErrorMessage: undefined,
      });
      const persisted = await this.saveOperation(resumed, operation.revision);
      if (!persisted) {
        return conflict("Re-encryption operation could not be resumed because it was updated concurrently.");
      }
      operation = persisted;
    }

    for (let processedThisInvocation = 0; processedThisInvocation < input.maxTargetsPerInvocation; processedThisInvocation += 1) {
      if (operation.currentIndex >= operation.targets.length) {
        const completed = Object.freeze({
          ...operation,
          state: SecretReEncryptionOperationStatuses.succeeded,
          updatedAt: input.occurredAt,
          completedAt: input.occurredAt,
          lastErrorCode: undefined,
          lastErrorMessage: undefined,
        });
        const persistedCompleted = await this.saveOperation(completed, operation.revision);
        if (!persistedCompleted) {
          return conflict("Re-encryption operation completion conflicted with a concurrent update.");
        }
        return {
          ok: true,
          value: toResult(persistedCompleted),
        };
      }

      const target = operation.targets[operation.currentIndex];
      if (!target) {
        break;
      }

      const iterationMutationKey = `${input.operationKey}:${operation.operationId}:${operation.currentIndex}`;
      try {
        const step = await this.processTarget({
          target,
          actorId: input.actorId,
          occurredAt: input.occurredAt,
          mutationOperationKey: iterationMutationKey,
        });
        const next = buildNextOperationState(operation, step.failure, input.occurredAt);
        const persisted = await this.saveOperation(next, operation.revision);
        if (!persisted) {
          return conflict("Re-encryption progress conflicted with a concurrent update.");
        }
        operation = persisted;
      } catch (error) {
        const failedState = Object.freeze({
          ...operation,
          state: SecretReEncryptionOperationStatuses.failed,
          updatedAt: input.occurredAt,
          completedAt: input.occurredAt,
          lastErrorCode: "re-encryption-step-failed",
          lastErrorMessage: toSafeErrorMessage(error, "Re-encryption step failed."),
        });
        const persistedFailed = await this.saveOperation(failedState, operation.revision);
        if (!persistedFailed) {
          return conflict("Re-encryption failure state conflicted with a concurrent update.");
        }
        return {
          ok: true,
          value: toResult(persistedFailed),
        };
      }
    }

    return {
      ok: true,
      value: toResult(operation),
    };
  }

  private async processTarget(input: {
    readonly target: SecretReEncryptionTarget;
    readonly actorId: string;
    readonly occurredAt: string;
    readonly mutationOperationKey: string;
  }): Promise<{ readonly failure?: SecretReEncryptionFailure }> {
    const record = await this.dependencies.secretRecordRepository.findSecretById(input.target.secretId);
    if (!record) {
      return Object.freeze({
        failure: createFailure(input, "secret-not-found", "Secret record was not found."),
      });
    }

    const version = record.versions.find((candidate) => candidate.versionId === input.target.versionId);
    if (!version || version.state !== "active") {
      return Object.freeze({
        failure: createFailure(input, "active-version-missing", "Active secret version is no longer available."),
      });
    }

    const decrypted = await this.dependencies.secretEncryptionPort.decryptSecretPlaintext({
      secretId: record.secretId,
      version,
    });
    const encrypted = await this.dependencies.secretEncryptionPort.encryptSecretPlaintext({
      secretId: record.secretId,
      owner: record.owner,
      plaintext: decrypted.plaintext,
      existingContext: version.keyEncryptionContext,
    });

    const updatedRecord = Object.freeze({
      ...record,
      versions: Object.freeze(record.versions.map((candidate) => {
        if (candidate.versionId !== version.versionId) {
          return candidate;
        }
        return Object.freeze({
          ...candidate,
          encryptedPayloadRef: encrypted.encryptedPayloadRef,
          payloadDigestSha256: encrypted.payloadDigestSha256,
          payloadByteLength: encrypted.payloadByteLength,
          keyEncryptionContext: encrypted.keyEncryptionContext,
        });
      })),
      lastModifiedAt: input.occurredAt,
      lastModifiedBy: input.actorId,
      reference: Object.freeze({
        ...record.reference,
        updatedAt: input.occurredAt,
      }),
    });

    if (this.dependencies.secretRecordRepository.saveSecretWhenCurrentVersionMatches) {
      const persisted = await this.dependencies.secretRecordRepository.saveSecretWhenCurrentVersionMatches(
        updatedRecord,
        {
          operationKey: input.mutationOperationKey,
          actorId: input.actorId,
          occurredAt: input.occurredAt,
        },
        record.currentVersionId,
      );
      if (!persisted.conditionMatched) {
        return Object.freeze({
          failure: createFailure(input, "secret-version-conflict", "Active version changed during re-encryption."),
        });
      }
      return Object.freeze({});
    }

    await this.dependencies.secretRecordRepository.saveSecret(updatedRecord, {
      operationKey: input.mutationOperationKey,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
    });
    return Object.freeze({});
  }

  private async saveOperation(
    operation: SecretReEncryptionOperationRecord,
    expectedRevision: number,
  ): Promise<SecretReEncryptionOperationRecord | undefined> {
    const saved = await this.dependencies.reEncryptionOperationRepository.saveReEncryptionOperation(
      operation,
      expectedRevision,
    );
    if (!saved.updated) {
      return undefined;
    }
    return saved.record;
  }

  private async emitOperation(
    outcome: keyof typeof SecretOperationalOutcomes,
    actorId: string,
    occurredAt: string,
    details: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    try {
      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.operation,
        operation: SecretAccessActions.reEncrypt,
        status: SecretOperationalOutcomes[outcome],
        reasonCode: resolveReasonCode(outcome, details),
        actor: Object.freeze({
          actorId,
        }),
        target: Object.freeze({
          scope: SecretScopes.server,
        }),
        occurredAt,
      }));
    } catch {
      // non-fatal by design
    }

    try {
      await this.observabilityPort.recordSecretOperation(Object.freeze({
        event: "secret.re-encrypt",
        outcome: SecretOperationalOutcomes[outcome],
        occurredAt,
        actorId,
        scope: SecretScopes.server,
        details,
      }));
    } catch {
      // non-fatal by design
    }
  }
}

function buildNextOperationState(
  operation: SecretReEncryptionOperationRecord,
  failure: SecretReEncryptionFailure | undefined,
  occurredAt: string,
): SecretReEncryptionOperationRecord {
  return Object.freeze({
    ...operation,
    currentIndex: operation.currentIndex + 1,
    failedCount: operation.failedCount + (failure ? 1 : 0),
    succeededCount: operation.succeededCount + (failure ? 0 : 1),
    failures: failure ? Object.freeze([...operation.failures, failure]) : operation.failures,
    updatedAt: occurredAt,
    completedAt: undefined,
    state: SecretReEncryptionOperationStatuses.running,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
  });
}

function createFailure(
  input: {
    readonly target: SecretReEncryptionTarget;
    readonly occurredAt: string;
  },
  reasonCode: string,
  message: string,
): SecretReEncryptionFailure {
  return Object.freeze({
    secretId: input.target.secretId,
    versionId: input.target.versionId,
    reasonCode,
    message,
    occurredAt: input.occurredAt,
  });
}

function toResult(operation: SecretReEncryptionOperationRecord): ReEncryptSecretsResult {
  const totalTargets = operation.targets.length;
  const processedTargets = operation.currentIndex;
  const remainingTargets = Math.max(totalTargets - processedTargets, 0);
  return Object.freeze({
    operationId: operation.operationId,
    status: operation.state,
    startedAt: operation.startedAt,
    updatedAt: operation.updatedAt,
    completedAt: operation.completedAt,
    totalTargets,
    processedTargets,
    succeededTargets: operation.succeededCount,
    failedTargets: operation.failedCount,
    remainingTargets,
    failures: operation.failures,
    lastErrorCode: operation.lastErrorCode,
    lastErrorMessage: operation.lastErrorMessage,
  });
}

function invalidRequest(message: string): SecretServiceResult<ReEncryptSecretsResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}

function conflict(message: string): SecretServiceResult<ReEncryptSecretsResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.conflict,
      message,
    }),
  };
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeTimestamp(value: string | undefined, now: () => Date): string | undefined {
  if (!value) {
    return now().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function normalizeMaxTargets(value: number | undefined): number | undefined {
  if (value === undefined) {
    return DEFAULT_MAX_TARGETS_PER_INVOCATION;
  }
  if (!Number.isInteger(value) || value < 1 || value > MAX_TARGETS_PER_INVOCATION) {
    return undefined;
  }
  return value;
}

function resolveReasonCode(
  outcome: keyof typeof SecretOperationalOutcomes,
  details: Readonly<Record<string, unknown>>,
): string {
  const detailReason = details.reason;
  if (typeof detailReason === "string" && detailReason.trim()) {
    return detailReason.trim();
  }
  if (outcome === SecretAuditOperationStatuses.succeeded) {
    return "operation-succeeded";
  }
  if (outcome === SecretAuditOperationStatuses.denied) {
    return "access-denied";
  }
  if (outcome === SecretAuditOperationStatuses.conflict) {
    return "operation-conflict";
  }
  return "operation-outcome";
}

function toSafeErrorMessage(_error: unknown, fallback: string): string {
  return fallback;
}

