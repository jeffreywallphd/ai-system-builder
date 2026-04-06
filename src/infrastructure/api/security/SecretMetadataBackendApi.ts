import { randomUUID } from "node:crypto";
import { WorkspaceMembershipStatuses } from "../../../domain/workspaces/WorkspaceDomain";
import { SecretAccessActions, SecretActorTypes, SecretScopes, type SecretAccessActor, type SecretKind, type SecretReference, type SecretScopeOwner } from "../../../domain/security/SecretDomain";
import type { CreateSecretUseCase } from "../../../application/security/use-cases/CreateSecretUseCase";
import type { DisableSecretUseCase } from "../../../application/security/use-cases/DisableSecretUseCase";
import type { GetSecretMetadataUseCase } from "../../../application/security/use-cases/GetSecretMetadataUseCase";
import type { ListSecretsUseCase } from "../../../application/security/use-cases/ListSecretsUseCase";
import type { ReEncryptSecretsUseCase } from "../../../application/security/use-cases/ReEncryptSecretsUseCase";
import type { RotateSecretUseCase } from "../../../application/security/use-cases/RotateSecretUseCase";
import { SecretServiceErrorCodes } from "../../../application/security/use-cases/SecretManagementServiceContracts";
import type { IWorkspaceAuthorizationReadRepository } from "../../../application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  SecretServiceHealthViewDto,
  SecretServiceOperationalDiagnosticsViewDto,
} from "../../../shared/dto/security/SecretServiceOperationalDiagnosticsDtos";
import { toSecretMetadataQueryDto } from "../../../shared/dto/security/SecretTransportDtos";
import {
  SecretApiSchemaValidationError,
  parseCreateSecretMetadataCommand,
  parseDisableSecretMetadataCommand,
  parseGetSecretReEncryptionStatusQuery,
  parseGetSecretMetadataQuery,
  parseListSecretMetadataQuery,
  parseReEncryptSecretsCommand,
  parseRotateSecretMetadataCommand,
} from "../../../shared/schemas/security/SecretApiSchemaContracts";
import {
  SecretMetadataApiErrorCodes,
  type CreateSecretMetadataApiRequest,
  type CreateSecretMetadataApiResponse,
  type DisableSecretMetadataApiRequest,
  type DisableSecretMetadataApiResponse,
  type GetSecretServiceDiagnosticsApiRequest,
  type GetSecretServiceDiagnosticsApiResponse,
  type GetSecretServiceHealthApiRequest,
  type GetSecretServiceHealthApiResponse,
  type GetSecretMetadataApiRequest,
  type GetSecretMetadataApiResponse,
  type GetSecretReEncryptionStatusApiRequest,
  type GetSecretReEncryptionStatusApiResponse,
  type ListSecretMetadataApiRequest,
  type ListSecretMetadataApiResponse,
  type ReEncryptSecretsMetadataApiRequest,
  type ReEncryptSecretsMetadataApiResponse,
  type RotateSecretMetadataApiRequest,
  type RotateSecretMetadataApiResponse,
  type SecretMetadataApiError,
  type SecretMetadataApiRecord,
  type SecretMetadataApiResponse,
  type SecretReEncryptionOperationApiRecord,
} from "./sdk/PublicSecretMetadataApiContract";

interface SecretMetadataBackendApiDependencies {
  readonly createSecretUseCase: CreateSecretUseCase;
  readonly getSecretMetadataUseCase: GetSecretMetadataUseCase;
  readonly listSecretsUseCase: ListSecretsUseCase;
  readonly disableSecretUseCase: DisableSecretUseCase;
  readonly rotateSecretUseCase: RotateSecretUseCase;
  readonly reEncryptSecretsUseCase: ReEncryptSecretsUseCase;
  readonly workspaceAuthorizationReadRepository?: IWorkspaceAuthorizationReadRepository;
  readonly secretOperationalDiagnosticsProvider?: {
    collectDiagnostics(): Promise<SecretServiceOperationalDiagnosticsViewDto>;
  };
  readonly clock?: {
    now(): Date;
  };
  readonly observabilityHook?: (event: SecretMetadataObservabilityEvent) => Promise<void> | void;
}

type SecretMetadataObservabilityEvent =
  | {
    readonly event: "secret-metadata.request.succeeded";
    readonly operation:
      | "create-secret"
      | "list-secrets"
      | "get-secret"
      | "disable-secret"
      | "rotate-secret"
      | "re-encrypt-secrets"
      | "get-re-encryption-status"
      | "get-secret-health"
      | "get-secret-diagnostics";
    readonly actorUserIdentityId?: string;
    readonly secretId?: string;
    readonly scope?: string;
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  }
  | {
    readonly event: "secret-metadata.request.failed";
    readonly operation:
      | "create-secret"
      | "list-secrets"
      | "get-secret"
      | "disable-secret"
      | "rotate-secret"
      | "re-encrypt-secrets"
      | "get-re-encryption-status"
      | "get-secret-health"
      | "get-secret-diagnostics";
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
const OpaqueSecretTokenPattern = /^[A-Za-z0-9+/_=-]{20,}$/;

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
    let parsedRequest: ReturnType<typeof parseCreateSecretMetadataCommand>;
    try {
      parsedRequest = parseCreateSecretMetadataCommand({
        operationKey: request.operationKey,
        secretId: request.secretId,
        name: request.name,
        owner: request.owner,
        kind: request.kind,
        plaintext: request.plaintext,
        metadata: request.metadata,
        classificationId: request.classificationId,
        rotationInstruction: request.rotationInstruction,
        createdAt: request.createdAt,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("create-secret", error.issues, request.actorUserIdentityId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("create-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actor = await this.resolveActorForOwner({
      actorUserIdentityId,
      owner: parsedRequest.owner,
      grantedActions: [SecretAccessActions.create],
      actorWorkspaceId: parsedRequest.owner.workspaceId,
    });

    const operationKey = normalizeOptional(parsedRequest.operationKey)
      ?? `secret-metadata:create:${parsedRequest.secretId}:${randomUUID()}`;

    const outcome = await this.dependencies.createSecretUseCase.execute({
      actor,
      operationKey,
      secretId: parsedRequest.secretId,
      name: parsedRequest.name,
      owner: parsedRequest.owner,
      kind: parsedRequest.kind,
      plaintext: parsedRequest.plaintext,
      metadata: parsedRequest.metadata,
      createdAt: parsedRequest.createdAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "create-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        parsedRequest.secretId,
        parsedRequest.owner.scope,
        parsedRequest.owner.workspaceId,
        parsedRequest.owner.userIdentityId,
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
    let parsedRequest: ReturnType<typeof parseListSecretMetadataQuery>;
    try {
      parsedRequest = parseListSecretMetadataQuery({
        owner: request.owner,
        actorWorkspaceId: request.actorWorkspaceId,
        kinds: request.kinds,
        tagAnyOf: request.tagAnyOf,
        includeDisabled: request.includeDisabled,
        includeArchived: request.includeArchived,
        includeSoftDeleted: request.includeSoftDeleted,
        limit: request.limit,
        offset: request.offset,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("list-secrets", error.issues, request.actorUserIdentityId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("list-secrets", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actor = await this.resolveActorForOwner({
      actorUserIdentityId,
      owner: parsedRequest.owner,
      grantedActions: [SecretAccessActions.list],
      actorWorkspaceId: parsedRequest.actorWorkspaceId ?? parsedRequest.owner.workspaceId,
    });

    const outcome = await this.dependencies.listSecretsUseCase.execute({
      actor,
      owner: parsedRequest.owner,
      kinds: parsedRequest.kinds,
      tagAnyOf: parsedRequest.tagAnyOf,
      includeDisabled: parsedRequest.includeDisabled,
      includeArchived: parsedRequest.includeArchived,
      includeSoftDeleted: parsedRequest.includeSoftDeleted,
      limit: parsedRequest.limit,
      offset: parsedRequest.offset,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "list-secrets",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        undefined,
        parsedRequest.owner.scope,
        parsedRequest.owner.workspaceId,
        parsedRequest.owner.userIdentityId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "list-secrets",
      actorUserIdentityId,
      scope: parsedRequest.owner.scope,
      workspaceId: parsedRequest.owner.workspaceId,
      userIdentityId: parsedRequest.owner.userIdentityId,
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
    let parsedRequest: ReturnType<typeof parseGetSecretMetadataQuery>;
    try {
      parsedRequest = parseGetSecretMetadataQuery({
        secretId: request.secretId,
        actorWorkspaceId: request.actorWorkspaceId,
        occurredAt: request.occurredAt,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("get-secret", error.issues, request.actorUserIdentityId, request.secretId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("get-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actorWorkspaceId = await this.resolveAuthorizedWorkspaceId(actorUserIdentityId, parsedRequest.actorWorkspaceId);
    const actor = createActor({
      actorUserIdentityId,
      actorWorkspaceId,
      grantedActions: [SecretAccessActions.readMetadata],
      actorType: SecretActorTypes.serverAdmin,
    });

    const outcome = await this.dependencies.getSecretMetadataUseCase.execute({
      actor,
      secretId: parsedRequest.secretId,
      occurredAt: parsedRequest.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "get-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        parsedRequest.secretId,
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
    let parsedRequest: ReturnType<typeof parseDisableSecretMetadataCommand>;
    try {
      parsedRequest = parseDisableSecretMetadataCommand({
        secretId: request.secretId,
        operationKey: request.operationKey,
        disabledAt: request.disabledAt,
        actorWorkspaceId: request.actorWorkspaceId,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("disable-secret", error.issues, request.actorUserIdentityId, request.secretId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("disable-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actorWorkspaceId = await this.resolveAuthorizedWorkspaceId(actorUserIdentityId, parsedRequest.actorWorkspaceId);
    const actor = createActor({
      actorUserIdentityId,
      actorWorkspaceId,
      grantedActions: [SecretAccessActions.disable],
      actorType: SecretActorTypes.serverAdmin,
    });

    const operationKey = normalizeOptional(parsedRequest.operationKey)
      ?? `secret-metadata:disable:${parsedRequest.secretId}:${randomUUID()}`;

    const outcome = await this.dependencies.disableSecretUseCase.execute({
      actor,
      operationKey,
      secretId: parsedRequest.secretId,
      disabledAt: parsedRequest.disabledAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "disable-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        parsedRequest.secretId,
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

  public async rotateSecret(
    request: RotateSecretMetadataApiRequest,
  ): Promise<SecretMetadataApiResponse<RotateSecretMetadataApiResponse>> {
    let parsedRequest: ReturnType<typeof parseRotateSecretMetadataCommand>;
    try {
      parsedRequest = parseRotateSecretMetadataCommand({
        secretId: request.secretId,
        plaintext: request.plaintext,
        operationKey: request.operationKey,
        expectedCurrentVersionId: request.expectedCurrentVersionId,
        rotatedAt: request.rotatedAt,
        actorWorkspaceId: request.actorWorkspaceId,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("rotate-secret", error.issues, request.actorUserIdentityId, request.secretId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("rotate-secret", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const actorWorkspaceId = await this.resolveAuthorizedWorkspaceId(actorUserIdentityId, parsedRequest.actorWorkspaceId);
    const actor = createActor({
      actorUserIdentityId,
      actorWorkspaceId,
      grantedActions: [SecretAccessActions.rotate],
      actorType: SecretActorTypes.serverAdmin,
    });

    const operationKey = normalizeOptional(parsedRequest.operationKey)
      ?? `secret-metadata:rotate:${parsedRequest.secretId}:${randomUUID()}`;

    const outcome = await this.dependencies.rotateSecretUseCase.execute({
      actor,
      operationKey,
      secretId: parsedRequest.secretId,
      plaintext: parsedRequest.plaintext,
      expectedCurrentVersionId: parsedRequest.expectedCurrentVersionId,
      rotatedAt: parsedRequest.rotatedAt,
    });

    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "rotate-secret",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
        parsedRequest.secretId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "rotate-secret",
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

  public async reEncryptSecrets(
    request: ReEncryptSecretsMetadataApiRequest,
  ): Promise<SecretMetadataApiResponse<ReEncryptSecretsMetadataApiResponse>> {
    let parsedRequest: ReturnType<typeof parseReEncryptSecretsCommand>;
    try {
      parsedRequest = parseReEncryptSecretsCommand({
        operationKey: request.operationKey,
        operationId: request.operationId,
        maxTargetsPerInvocation: request.maxTargetsPerInvocation,
        occurredAt: request.occurredAt,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("re-encrypt-secrets", error.issues, request.actorUserIdentityId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        "re-encrypt-secrets",
        SecretMetadataApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const actor = createActor({
      actorUserIdentityId,
      grantedActions: [SecretAccessActions.reEncrypt],
      actorType: SecretActorTypes.serverAdmin,
    });
    const operationKey = normalizeOptional(parsedRequest.operationKey)
      ?? `secret-metadata:re-encrypt:${randomUUID()}`;

    const outcome = await this.dependencies.reEncryptSecretsUseCase.execute({
      actor,
      operationKey,
      operationId: parsedRequest.operationId,
      maxTargetsPerInvocation: parsedRequest.maxTargetsPerInvocation,
      occurredAt: parsedRequest.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "re-encrypt-secrets",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "re-encrypt-secrets",
      actorUserIdentityId,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        operation: toSecretReEncryptionOperationApiRecord(outcome.value),
      }),
    });
  }

  public async getSecretReEncryptionStatus(
    request: GetSecretReEncryptionStatusApiRequest,
  ): Promise<SecretMetadataApiResponse<GetSecretReEncryptionStatusApiResponse>> {
    let parsedRequest: ReturnType<typeof parseGetSecretReEncryptionStatusQuery>;
    try {
      parsedRequest = parseGetSecretReEncryptionStatusQuery({
        operationId: request.operationId,
        occurredAt: request.occurredAt,
      });
    } catch (error) {
      if (error instanceof SecretApiSchemaValidationError) {
        return this.failedValidation("get-re-encryption-status", error.issues, request.actorUserIdentityId);
      }
      throw error;
    }

    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        "get-re-encryption-status",
        SecretMetadataApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const actor = createActor({
      actorUserIdentityId,
      grantedActions: [SecretAccessActions.reEncrypt],
      actorType: SecretActorTypes.serverAdmin,
    });
    const outcome = await this.dependencies.reEncryptSecretsUseCase.getStatus({
      actor,
      operationId: parsedRequest.operationId,
      occurredAt: parsedRequest.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromSecretServiceResult(
        "get-re-encryption-status",
        outcome.error.code,
        outcome.error.message,
        actorUserIdentityId,
      );
    }

    await this.emitObservability({
      event: "secret-metadata.request.succeeded",
      operation: "get-re-encryption-status",
      actorUserIdentityId,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        operation: toSecretReEncryptionOperationApiRecord(outcome.value),
      }),
    });
  }

  public async getSecretServiceHealth(
    request: GetSecretServiceHealthApiRequest,
  ): Promise<SecretMetadataApiResponse<GetSecretServiceHealthApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed("get-secret-health", SecretMetadataApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    if (!this.dependencies.secretOperationalDiagnosticsProvider) {
      return this.failed(
        "get-secret-health",
        SecretMetadataApiErrorCodes.internal,
        "Secret service diagnostics are unavailable.",
        actorUserIdentityId,
      );
    }

    try {
      const diagnostics = await this.dependencies.secretOperationalDiagnosticsProvider.collectDiagnostics();
      await this.emitObservability({
        event: "secret-metadata.request.succeeded",
        operation: "get-secret-health",
        actorUserIdentityId,
      });
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          health: toHealthView(diagnostics),
        }),
      });
    } catch (error) {
      return this.failed(
        "get-secret-health",
        SecretMetadataApiErrorCodes.internal,
        toSafeClientErrorMessage(error, "Failed to resolve secret service health."),
        actorUserIdentityId,
      );
    }
  }

  public async getSecretServiceDiagnostics(
    request: GetSecretServiceDiagnosticsApiRequest,
  ): Promise<SecretMetadataApiResponse<GetSecretServiceDiagnosticsApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        "get-secret-diagnostics",
        SecretMetadataApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    if (!this.dependencies.secretOperationalDiagnosticsProvider) {
      return this.failed(
        "get-secret-diagnostics",
        SecretMetadataApiErrorCodes.internal,
        "Secret service diagnostics are unavailable.",
        actorUserIdentityId,
      );
    }

    try {
      const diagnostics = await this.dependencies.secretOperationalDiagnosticsProvider.collectDiagnostics();
      await this.emitObservability({
        event: "secret-metadata.request.succeeded",
        operation: "get-secret-diagnostics",
        actorUserIdentityId,
      });
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          diagnostics: sanitizeSecretServiceOperationalDiagnostics(diagnostics),
        }),
      });
    } catch (error) {
      return this.failed(
        "get-secret-diagnostics",
        SecretMetadataApiErrorCodes.internal,
        toSafeClientErrorMessage(error, "Failed to resolve secret service diagnostics."),
        actorUserIdentityId,
      );
    }
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

  private failedValidation(
    operation: SecretMetadataObservabilityEvent["operation"],
    issues: ReadonlyArray<{ readonly path: string; readonly code: string; readonly message: string }>,
    actorUserIdentityId?: string,
    secretId?: string,
  ): SecretMetadataApiResponse<never> {
    void this.emitObservability({
      event: "secret-metadata.request.failed",
      operation,
      actorUserIdentityId,
      code: SecretMetadataApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      secretId,
    });

    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SecretMetadataApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(issues.map((issue) => Object.freeze({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        }))),
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
  const dto = toSecretMetadataQueryDto(reference);
  return Object.freeze({
    secretId: dto.secretId,
    name: dto.name,
    scope: dto.scope,
    workspaceId: dto.workspaceId,
    userIdentityId: dto.userIdentityId,
    kind: dto.kind,
    state: dto.state,
    currentVersionId: dto.currentVersionId,
    metadata: dto.metadata,
    updatedAt: dto.updatedAt,
  });
}

function toSecretReEncryptionOperationApiRecord(
  operation: {
    readonly operationId: string;
    readonly status: "running" | "succeeded" | "failed";
    readonly startedAt: string;
    readonly updatedAt: string;
    readonly completedAt?: string;
    readonly totalTargets: number;
    readonly processedTargets: number;
    readonly succeededTargets: number;
    readonly failedTargets: number;
    readonly remainingTargets: number;
    readonly failures: ReadonlyArray<{
      readonly secretId: string;
      readonly versionId: string;
      readonly reasonCode: string;
      readonly message: string;
      readonly occurredAt: string;
    }>;
    readonly lastErrorCode?: string;
    readonly lastErrorMessage?: string;
  },
): SecretReEncryptionOperationApiRecord {
  return Object.freeze({
    operationId: operation.operationId,
    status: operation.status,
    startedAt: operation.startedAt,
    updatedAt: operation.updatedAt,
    completedAt: operation.completedAt,
    totalTargets: operation.totalTargets,
    processedTargets: operation.processedTargets,
    succeededTargets: operation.succeededTargets,
    failedTargets: operation.failedTargets,
    remainingTargets: operation.remainingTargets,
    failures: Object.freeze(operation.failures.map((failure) => Object.freeze({
      secretId: failure.secretId,
      versionId: failure.versionId,
      reasonCode: failure.reasonCode,
      message: toSafeClientErrorMessage(failure.message, "Secret re-encryption step failed."),
      occurredAt: failure.occurredAt,
    }))),
    lastErrorCode: normalizeOptional(operation.lastErrorCode),
    lastErrorMessage: operation.lastErrorMessage
      ? toSafeClientErrorMessage(operation.lastErrorMessage, "Secret re-encryption failed.")
      : undefined,
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
    if (!normalized || SensitiveSecretErrorMessagePattern.test(normalized) || containsOpaqueSecretToken(normalized)) {
      return fallback;
    }
    return normalized;
  }

  if (error instanceof Error) {
    const normalized = error.message.trim();
    if (!normalized || SensitiveSecretErrorMessagePattern.test(normalized) || containsOpaqueSecretToken(normalized)) {
      return fallback;
    }
    return normalized;
  }

  return fallback;
}

function containsOpaqueSecretToken(input: string): boolean {
  const tokens = input.split(/[^A-Za-z0-9+/_=-]+/g).filter((token) => token.length > 0);
  return tokens.some((token) => OpaqueSecretTokenPattern.test(token));
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toHealthView(input: SecretServiceOperationalDiagnosticsViewDto): SecretServiceHealthViewDto {
  return Object.freeze({
    state: input.state,
    checkedAt: input.checkedAt,
    healthFlags: Object.freeze({
      encryptionMaterialAvailable: input.healthFlags.encryptionMaterialAvailable,
      repositoryReachable: input.healthFlags.repositoryReachable,
      bootstrapSecretsHealthy: input.healthFlags.bootstrapSecretsHealthy,
      runtimeDependenciesHealthy: input.healthFlags.runtimeDependenciesHealthy,
    }),
  });
}

function sanitizeSecretServiceOperationalDiagnostics(
  input: SecretServiceOperationalDiagnosticsViewDto,
): SecretServiceOperationalDiagnosticsViewDto {
  return Object.freeze({
    ...toHealthView(input),
    diagnostics: Object.freeze(input.diagnostics.map((entry) => Object.freeze({
      code: normalizeOptional(entry.code) ?? "secret-diagnostic",
      severity: entry.severity,
      message: toSafeClientErrorMessage(entry.message, "Secret service diagnostic emitted."),
      secretId: normalizeOptional(entry.secretId),
    }))),
    bootstrap: Object.freeze({
      requiredSecretIds: Object.freeze([...input.bootstrap.requiredSecretIds]),
      diagnostics: Object.freeze(input.bootstrap.diagnostics.map((entry) => Object.freeze({
        code: normalizeOptional(entry.code) ?? "secret-diagnostic",
        severity: entry.severity,
        message: toSafeClientErrorMessage(entry.message, "Secret service diagnostic emitted."),
        secretId: normalizeOptional(entry.secretId),
      }))),
    }),
  });
}
