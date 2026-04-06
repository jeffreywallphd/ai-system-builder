import {
  SecretAccessActions,
  SecretKinds,
  createSecretScopeOwner,
  type SecretScope,
  type SecretKind,
} from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretRecordPersistenceRepository,
} from "../ports/SecretServicePorts";
import {
  NoOpSecretObservabilityPort,
  SecretOperationalOutcomes,
  type ISecretObservabilityPort,
} from "../ports/SecretObservabilityPorts";
import {
  SecretServiceErrorCodes,
  type ListSecretsRequest,
  type ListSecretsResult,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export interface ListSecretsUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class ListSecretsUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: ListSecretsUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(request: ListSecretsRequest): Promise<SecretServiceResult<ListSecretsResult>> {
    const actorId = normalizeRequired(request.actor?.actorId);
    if (!actorId) {
      return invalidRequest("actor.actorId is required.");
    }

    if (!request.owner) {
      return invalidRequest("owner is required.");
    }

    const occurredAt = this.now().toISOString();

    let owner: ReturnType<typeof createSecretScopeOwner>;
    try {
      owner = createSecretScopeOwner(request.owner);
    } catch (error) {
      return invalidRequest(toErrorMessage(error));
    }

    const invalidKind = (request.kinds ?? []).find((kind) => !isSecretKind(kind));
    if (invalidKind) {
      return invalidRequest(`Secret kind '${String(invalidKind)}' is not allowed.`);
    }

    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.list,
      actor: request.actor,
      owner,
      occurredAt,
    });
    await this.dependencies.secretAccessAuditPort.recordSecretAccessDecision(Object.freeze({
      scope: owner.scope,
      action: SecretAccessActions.list,
      decision: decision.allowed ? "allowed" : "denied",
      reason: decision.reason,
      actorId,
      actorType: request.actor.actorType,
      workspaceId: request.actor.workspaceId,
      userIdentityId: request.actor.userIdentityId,
      occurredAt: decision.occurredAt,
    }));

    if (!decision.allowed) {
      await this.emitOperation("denied", {
        occurredAt: decision.occurredAt,
        actorId,
        scope: owner.scope,
        workspaceId: owner.workspaceId,
        userIdentityId: owner.userIdentityId,
        details: Object.freeze({
          reason: decision.reason,
        }),
      });
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Secret list access denied (${decision.reason}).`,
        }),
      };
    }

    const normalizedTags = normalizeTags(request.tagAnyOf);
    const items = await this.dependencies.secretRecordRepository.listSecrets({
      scope: owner.scope,
      workspaceId: owner.workspaceId,
      userIdentityId: owner.userIdentityId,
      kinds: request.kinds,
      tagAnyOf: normalizedTags,
      includeDisabled: request.includeDisabled,
      includeRevoked: request.includeRevoked,
      includeDeleted: request.includeDeleted,
      limit: request.limit,
      offset: request.offset,
    });

    await this.emitOperation("succeeded", {
      occurredAt: decision.occurredAt,
      actorId,
      scope: owner.scope,
      workspaceId: owner.workspaceId,
      userIdentityId: owner.userIdentityId,
      details: Object.freeze({
        count: items.length,
      }),
    });
    return {
      ok: true,
      value: Object.freeze({
        items,
      }),
    };
  }

  private async emitOperation(
    outcome: keyof typeof SecretOperationalOutcomes,
    input: {
      readonly occurredAt: string;
      readonly actorId?: string;
      readonly scope?: SecretScope;
      readonly workspaceId?: string;
      readonly userIdentityId?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    },
  ): Promise<void> {
    try {
      await this.observabilityPort.recordSecretOperation(Object.freeze({
        event: "secret.list",
        outcome: SecretOperationalOutcomes[outcome],
        occurredAt: input.occurredAt,
        actorId: input.actorId,
        scope: input.scope,
        workspaceId: input.workspaceId,
        userIdentityId: input.userIdentityId,
        details: input.details,
      }));
    } catch {
      // Observability failures are intentionally non-fatal.
    }
  }
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isSecretKind(value: unknown): value is SecretKind {
  return typeof value === "string" && Object.values(SecretKinds).includes(value as SecretKind);
}

function normalizeTags(tags: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined {
  if (!tags) {
    return undefined;
  }
  const normalized = [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).values())];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function invalidRequest(message: string): SecretServiceResult<ListSecretsResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Secret list request is invalid.";
}
