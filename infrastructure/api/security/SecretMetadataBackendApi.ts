import { randomUUID } from "node:crypto";
import { WorkspaceMembershipStatuses } from "../../../src/domain/workspaces/WorkspaceDomain";
import { SecretAccessActions, SecretActorTypes, SecretScopes, type SecretAccessActor, type SecretKind, type SecretReference, type SecretScopeOwner } from "../../../src/domain/security/SecretDomain";
import type { CreateSecretUseCase } from "../../../src/application/security/use-cases/CreateSecretUseCase";
import type { DisableSecretUseCase } from "../../../src/application/security/use-cases/DisableSecretUseCase";
import type { GetSecretMetadataUseCase } from "../../../src/application/security/use-cases/GetSecretMetadataUseCase";
import type { ListSecretsUseCase } from "../../../src/application/security/use-cases/ListSecretsUseCase";
import { SecretServiceErrorCodes } from "../../../src/application/security/use-cases/SecretManagementServiceContracts";
import type { IWorkspaceAuthorizationReadRepository } from "../../../src/application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  SecretMetadataApiErrorCodes,
  type CreateSecretMetadataApiRequest,
  type CreateSecretMetadataApiResponse,
  type DisableSecretMetadataApiRequest,
  type DisableSecretMetadataApiResponse,
  type GetSecretMetadataApiRequest,
  type GetSecretMetadataApiResponse,
  type ListSecretMetadataApiRequest,
  type ListSecretMetadataApiResponse,
  type SecretMetadataApiError,
  type SecretMetadataApiRecord,
  type SecretMetadataApiResponse,
} from "./sdk/PublicSecretMetadataApiContract";

interface SecretMetadataBackendApiDependencies {
  readonly createSecretUseCase: CreateSecretUseCase;
  readonly getSecretMetadataUseCase: GetSecretMetadataUseCase;
  readonly listSecretsUseCase: ListSecretsUseCase;
  readonly disableSecretUseCase: DisableSecretUseCase;
  readonly workspaceAuthorizationReadRepository?: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
  readonly observabilityHook?: (event: SecretMetadataObservabilityEvent) => Promise<void> | void;
}

type SecretMetadataObservabilityEvent =
  | {
    readonly event: "secret-metadata.request.succeeded";
    readonly operation: "create-secret" | "list-secrets" | "get-secret" | "disable-secret";
    readonly actorUserIdentityId?: string;
    readonly secretId?: string;
    readonly scope?: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  }
  | {
    readonly event: "secret-metadata.request.failed";
    readonly operation: "create-secret" | "list-secrets" | "get-secret" | "disable-secret";
    readonly actorUserIdentityId?: string;
    readonly code: SecretMetadataApiError["code"];
    readonly message: string;
    readonly secretId?: string;
    readonly scope?: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  };

const SensitiveSecretErrorMessagePattern =
  /(plaintext|token|password|secret|api[_-]?key|private[_-]?key|BEGIN\s+[A-Z\s-]+|encryptedPayloadRef|payloadDigestSha256|secret-store:)/i;

export class SecretMetadataBackendApi {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: SecretMetadataBackendApiDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async createSecret(
    request: CreateSecretMetadataApiRequest,
  ): Promise<SecretMetadataApiResponse<CreateSecretMetadataApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("create-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actor = await this.resolveActorForOwner({
      actorUserIdentityId,
      owner: request.owner,
      grantedActions: [SecretAccessActions.create],
      actorWorkspaceId: request.owner.workspaceId,
    });

    const operationKey = normalizeOptional(request.operationKey)
      ?? `secret-metadata:create:${request.secretId}:${randomUUID()}`;

    const outcome = await this.dependencies.createSecretUseCase.execute({
      actor,
      operationKey,
      secretId: request.secretId,
      name: request.name,
      owner: request.owner,
      kind: request.kind,
      plaintext: request.plaintext,
      metadata: request.metadata,
      createdAt: request.createdAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "create-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        request.secretId,
        request.owner.scope,
        request.owner.workspaceId,
        request.owner.userIdentityId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "create-secret",
      actorUserIdentityId,
      secretId: outcome.value.secret.secretId,
      scope: outcome.value.secret.scope,
      workspaceId: outcome.value.secret.workspaceId,
      userIdentityId: outcome.value.secret.userIdentityId,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        secret: toSecretMetadataApiRecord(outcome.value.secret),
      }),
    });
  }

  public async listSecrets(
    request: ListSecretMetadataApiRequest,
  ): Promise<SecretMetadataApiResponse<ListSecretMetadataApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("list-secrets", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actor = await this.resolveActorForOwner({
      actorUserIdentityId,
      owner: request.owner,
      grantedActions: [SecretAccessActions.list],
      actorWorkspaceId: request.actorWorkspaceId ?? request.owner.workspaceId,
    });

    const outcome = await this.dependencies.listSecretsUseCase.execute({
      actor,
      owner: request.owner,
      kinds: request.kinds,
      tagAnyOf: request.tagAnyOf,
      includeDisabled: request.includeDisabled,
      includeRevoked: request.includeRevoked,
      includeDeleted: request.includeDeleted,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "list-secrets",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        undefined,
        request.owner.scope,
        request.owner.workspaceId,
        request.owner.userIdentityId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "list-secrets",
      actorUserIdentityId,
      scope: request.owner.scope,
      workspaceId: request.owner.workspaceId,
      userIdentityId: request.owner.userIdentityId,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        items: Object.freeze(outcome.value.items.map((item) => toSecretMetadataApiRecord(item))),
      }),
    });
  }

  public async getSecret(
    request: GetSecretMetadataApiRequest,
  ): Promise<SecretMetadataApiResponse<GetSecretMetadataApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("get-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actorWorkspaceId = await this.resolveAuthorizedWorkspaceId(actorUserIdentityId, request.actorWorkspaceId);
    const actor = createActor({
      actorUserIdentityId,
      actorWorkspaceId,
      grantedActions: [SecretAccessActions.readMetadata],
      actorType: SecretActorTypes.serverAdmin,
    });

    const outcome = await this.dependencies.getSecretMetadataUseCase.execute({
      actor,
      secretId: request.secretId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "get-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        request.secretId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "get-secret",
      actorUserIdentityId,
      secretId: outcome.value.secretId,
      scope: outcome.value.scope,
      workspaceId: outcome.value.workspaceId,
      userIdentityId: outcome.value.userIdentityId,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        secret: toSecretMetadataApiRecord(outcome.value),
      }),
    });
  }

  public async disableSecret(
    request: DisableSecretMetadataApiRequest,
  ): Promise<SecretMetadataApiResponse<DisableSecretMetadataApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("disable-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actorWorkspaceId = await this.resolveAuthorizedWorkspaceId(actorUserIdentityId, request.actorWorkspaceId);
    const actor = createActor({
      actorUserIdentityId,
      actorWorkspaceId,
      grantedActions: [SecretAccessActions.disable],
      actorType: SecretActorTypes.serverAdmin,
    });

    const operationKey = normalizeOptional(request.operationKey)
      ?? `secret-metadata:disable:${request.secretId}:${randomUUID()}`;

    const outcome = await this.dependencies.disableSecretUseCase.execute({
      actor,
      operationKey,
      secretId: request.secretId,
      disabledAt: request.disabledAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "disable-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        request.secretId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "disable-secret",
      actorUserIdentityId,
      secretId: outcome.value.secretId,
      scope: outcome.value.scope,
      workspaceId: outcome.value.workspaceId,
      userIdentityId: outcome.value.userIdentityId,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        secret: toSecretMetadataApiRecord(outcome.value),
      }),
    });
  }

  private async resolveActorForOwner(input: {
    readonly actorUserIdentityId: string;
    readonly owner: SecretScopeOwner;
    readonly grantedActions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>;
    readonly actorWorkspaceId?: string;
  }): Promise<SecretAccessActor> {
    const ownerScope = input.owner.scope;
    if (ownerScope === SecretScopes.server) {
      return createActor({
        actorUserIdentityId: input.actorUserIdentityId,
        grantedActions: input.grantedActions,
        actorType: SecretActorTypes.serverAdmin,
      });
    }

    const ownerWorkspaceId = normalizeOptional(input.owner.workspaceId);
    const requestedWorkspaceId = normalizeOptional(input.actorWorkspaceId) ?? ownerWorkspaceId;
    const authorizedWorkspaceId = await this.resolveAuthorizedWorkspaceId(input.actorUserIdentityId, requestedWorkspaceId);

    return createActor({
      actorUserIdentityId: input.actorUserIdentityId,
      actorWorkspaceId: authorizedWorkspaceId,
      grantedActions: input.grantedActions,
      actorType: SecretActorTypes.serverAdmin,
    });
  }

  private async resolveAuthorizedWorkspaceId(
    actorUserIdentityId: string,
    workspaceId: string | undefined,
  ): Promise<string | undefined> {
    const normalizedWorkspaceId = normalizeOptional(workspaceId);
    if (!normalizedWorkspaceId || !this.dependencies.workspaceAuthorizationReadRepository) {
      return undefined;
    }

    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId: normalizedWorkspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: this.clock.now().toISOString(),
    });

    if (!snapshot) {
      return undefined;
    }

    if (snapshot.isWorkspaceOwner) {
      return normalizedWorkspaceId;
    }

    if (snapshot.membership?.status === WorkspaceMembershipStatuses.active) {
      return normalizedWorkspaceId;
    }

    return undefined;
  }

  private failedFromSecretServiceResult(
    operation: SecretMetadataObservabilityEvent["operation"],
    code: string,
    message: string,
    actorUserIdentityId?: string,
    secretId?: string,
    scope?: string,
    workspaceId?: string,
    userIdentityId?: string,
  ): SecretMetadataApiResponse<never> {
    switch (code) {
      case SecretServiceErrorCodes.invalidRequest:
        return this.failed(operation, SecretMetadataApiErrorCodes.invalidRequest, toSafeClientErrorMessage(message, "Secret request is invalid."), actorUserIdentityId, secretId, scope, workspaceId, userIdentityId);
      case SecretServiceErrorCodes.accessDenied:
        return this.failed(operation, SecretMetadataApiErrorCodes.forbidden, toSafeClientErrorMessage(message, "Secret access is forbidden."), actorUserIdentityId, secretId, scope, workspaceId, userIdentityId);
      case SecretServiceErrorCodes.notFound:
        return this.failed(operation, SecretMetadataApiErrorCodes.notFound, toSafeClientErrorMessage(message, "Secret metadata was not found."), actorUserIdentityId, secretId, scope, workspaceId, userIdentityId);
      case SecretServiceErrorCodes.conflict:
      case SecretServiceErrorCodes.invalidState:
      case SecretServiceErrorCodes.policyViolation:
        return this.failed(operation, SecretMetadataApiErrorCodes.conflict, toSafeClientErrorMessage(message, "Secret mutation conflicts with current state."), actorUserIdentityId, secretId, scope, workspaceId, userIdentityId);
      default:
        return this.failed(operation, SecretMetadataApiErrorCodes.internal, toSafeClientErrorMessage(message, "Secret metadata operation failed."), actorUserIdentityId, secretId, scope, workspaceId, userIdentityId);
    }
  }

  private failed(
    operation: SecretMetadataObservabilityEvent["operation"],
    code: SecretMetadataApiError["code"],
    message: string,
    actorUserIdentityId?: string,
    secretId?: string,
    scope?: string,
    workspaceId?: string,
    userIdentityId?: string,
  ): SecretMetadataApiResponse<never> {
    void this.emitObservability({
      event: "secret-metadata.request.failed",
      operation,
      actorUserIdentityId,
      code,
      message,
      secretId,
      scope,
      workspaceId,
      userIdentityId,
    });
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
      }),
    });
  }

  private async emitObservability(event: SecretMetadataObservabilityEvent): Promise<void> {
    if (!this.dependencies.observabilityHook) {
      return;
    }

    try {
      await this.dependencies.observabilityHook(sanitizeObservabilityEvent(event));
    } catch {
      // Intentionally non-fatal.
    }
  }
}

function createActor(input: {
  readonly actorUserIdentityId: string;
  readonly actorWorkspaceId?: string;
  readonly grantedActions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>;
  readonly actorType: typeof SecretActorTypes[keyof typeof SecretActorTypes];
}): SecretAccessActor {
  return Object.freeze({
    actorId: input.actorUserIdentityId,
    actorType: input.actorType,
    workspaceId: normalizeOptional(input.actorWorkspaceId),
    userIdentityId: input.actorUserIdentityId,
    grantedActions: Object.freeze([...new Set(input.grantedActions)]),
  });
}

function toSecretMetadataApiRecord(reference: SecretReference): SecretMetadataApiRecord {
  return Object.freeze({
    secretId: reference.secretId,
    name: reference.name,
    scope: reference.scope,
    workspaceId: reference.workspaceId,
    userIdentityId: reference.userIdentityId,
    kind: reference.kind,
    state: reference.state,
    currentVersionId: reference.currentVersionId,
    metadata: reference.metadata,
    updatedAt: reference.updatedAt,
  });
}

function sanitizeObservabilityEvent(event: SecretMetadataObservabilityEvent): SecretMetadataObservabilityEvent {
  if (event.event === "secret-metadata.request.succeeded") {
    return Object.freeze({
      ...event,
      actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
      secretId: normalizeOptional(event.secretId),
      scope: normalizeOptional(event.scope),
      workspaceId: normalizeOptional(event.workspaceId),
      userIdentityId: normalizeOptional(event.userIdentityId),
    });
  }

  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
    message: toSafeClientErrorMessage(event.message, "Secret metadata operation failed."),
    secretId: normalizeOptional(event.secretId),
    scope: normalizeOptional(event.scope),
    workspaceId: normalizeOptional(event.workspaceId),
    userIdentityId: normalizeOptional(event.userIdentityId),
  });
}

function toSafeClientErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    const normalized = error.trim();
    if (!normalized || SensitiveSecretErrorMessagePattern.test(normalized)) {
      return fallback;
    }
    return normalized;
  }

  if (error instanceof Error) {
    const normalized = error.message.trim();
    if (!normalized || SensitiveSecretErrorMessagePattern.test(normalized)) {
      return fallback;
    }
    return normalized;
  }

  return fallback;
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
