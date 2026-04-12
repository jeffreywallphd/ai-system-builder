import {
  SecretAccessActions,
  SecretScopes,
  createSecretScopeOwner,
  type SecretAccessActor,
  type SecretAccessAction,
  type SecretScopeOwner,
} from "@domain/security/SecretDomain";
import type {
  ISecretProviderMaterialResolutionPort,
  ResolveSecretProviderMaterialExistenceInput,
  ResolveSecretProviderMaterialMetadataInput,
  ResolveSecretProviderMaterialInput,
  SecretProviderMaterialMetadata,
  ResolvedSecretProviderMaterialValue,
  SecretProviderMaterialKind,
} from "../ports/SecretProviderPorts";
import type { ISecretAccessPolicyPort } from "../ports/SecretServicePorts";
import {
  SecretAuditEventKinds,
  type ISecretAccessAuditPort,
  type SecretAuditOperationStatus,
} from "../ports/SecretServicePorts";
import {
  SecretServiceErrorCodes,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

interface ScopedSecretProviderMaterialRequestBase {
  readonly caller: SecretAccessActor;
  readonly providerId: string;
  readonly secretId: string;
  readonly materialKind: SecretProviderMaterialKind;
  readonly access: {
    readonly operationKey: string;
    readonly serviceIdentity: string;
    readonly usage: string;
    readonly justification?: string;
    readonly occurredAt?: string;
  };
}

export interface RetrieveServerScopedSecretProviderMaterialRequest extends ScopedSecretProviderMaterialRequestBase {}

export interface RetrieveWorkspaceScopedSecretProviderMaterialRequest extends ScopedSecretProviderMaterialRequestBase {
  readonly workspaceId: string;
}

export interface RetrieveUserScopedSecretProviderMaterialRequest extends ScopedSecretProviderMaterialRequestBase {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
}

export interface GetServerScopedSecretProviderMaterialMetadataRequest extends ScopedSecretProviderMaterialRequestBase {}

export interface GetWorkspaceScopedSecretProviderMaterialMetadataRequest extends ScopedSecretProviderMaterialRequestBase {
  readonly workspaceId: string;
}

export interface GetUserScopedSecretProviderMaterialMetadataRequest extends ScopedSecretProviderMaterialRequestBase {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
}

export interface ScopedSecretProviderMaterialRetrievalUseCaseDependencies {
  readonly secretProviderResolutionPort: ISecretProviderMaterialResolutionPort;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort?: ISecretAccessAuditPort;
  readonly now?: () => Date;
}

export class ScopedSecretProviderMaterialRetrievalUseCase {
  private readonly now: () => Date;
  private readonly secretAccessAuditPort: ISecretAccessAuditPort;

  public constructor(private readonly dependencies: ScopedSecretProviderMaterialRetrievalUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.secretAccessAuditPort = dependencies.secretAccessAuditPort ?? new NoOpScopedSecretAccessAuditPort();
  }

  public async retrieveServerScopedSecretProviderMaterial(
    request: RetrieveServerScopedSecretProviderMaterialRequest,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    return this.retrieveScopedSecretProviderMaterial(request, {
      scope: SecretScopes.server,
    });
  }

  public async retrieveWorkspaceScopedSecretProviderMaterial(
    request: RetrieveWorkspaceScopedSecretProviderMaterialRequest,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    return this.retrieveScopedSecretProviderMaterial(request, {
      scope: SecretScopes.workspace,
      workspaceId: request.workspaceId,
    });
  }

  public async retrieveUserScopedSecretProviderMaterial(
    request: RetrieveUserScopedSecretProviderMaterialRequest,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    return this.retrieveScopedSecretProviderMaterial(request, {
      scope: SecretScopes.user,
      workspaceId: request.workspaceId,
      userIdentityId: request.userIdentityId,
    });
  }

  public async getServerScopedSecretProviderMaterialMetadata(
    request: GetServerScopedSecretProviderMaterialMetadataRequest,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    return this.getScopedSecretProviderMaterialMetadata(request, {
      scope: SecretScopes.server,
    });
  }

  public async getWorkspaceScopedSecretProviderMaterialMetadata(
    request: GetWorkspaceScopedSecretProviderMaterialMetadataRequest,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    return this.getScopedSecretProviderMaterialMetadata(request, {
      scope: SecretScopes.workspace,
      workspaceId: request.workspaceId,
    });
  }

  public async getUserScopedSecretProviderMaterialMetadata(
    request: GetUserScopedSecretProviderMaterialMetadataRequest,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    return this.getScopedSecretProviderMaterialMetadata(request, {
      scope: SecretScopes.user,
      workspaceId: request.workspaceId,
      userIdentityId: request.userIdentityId,
    });
  }

  public async serverScopedSecretProviderMaterialExists(
    request: GetServerScopedSecretProviderMaterialMetadataRequest,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    return this.scopedSecretProviderMaterialExists(request, {
      scope: SecretScopes.server,
    });
  }

  public async workspaceScopedSecretProviderMaterialExists(
    request: GetWorkspaceScopedSecretProviderMaterialMetadataRequest,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    return this.scopedSecretProviderMaterialExists(request, {
      scope: SecretScopes.workspace,
      workspaceId: request.workspaceId,
    });
  }

  public async userScopedSecretProviderMaterialExists(
    request: GetUserScopedSecretProviderMaterialMetadataRequest,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    return this.scopedSecretProviderMaterialExists(request, {
      scope: SecretScopes.user,
      workspaceId: request.workspaceId,
      userIdentityId: request.userIdentityId,
    });
  }

  private async retrieveScopedSecretProviderMaterial(
    request: ScopedSecretProviderMaterialRequestBase,
    ownerInput: SecretScopeOwner,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    const prepared = await this.prepareRequest(request, ownerInput, SecretAccessActions.retrievePlaintext);
    if (!prepared.ok) {
      return prepared;
    }

    const input: ResolveSecretProviderMaterialInput = Object.freeze({
      selector: Object.freeze({
        providerId: prepared.value.providerId,
        secretId: prepared.value.secretId,
        scope: prepared.value.owner,
        materialKind: prepared.value.materialKind,
      }),
      access: prepared.value.access,
    });

    const resolved = await this.dependencies.secretProviderResolutionPort.resolveSecretProviderMaterial(input);
    await this.emitOperationFromResolutionResult({
      action: SecretAccessActions.retrievePlaintext,
      actor: request.caller,
      target: prepared.value.owner,
      secretId: prepared.value.secretId,
      operationKey: prepared.value.access.operationKey,
      occurredAt: prepared.value.access.occurredAt,
      serviceIdentity: prepared.value.access.serviceIdentity,
      result: resolved,
      details: resolved.ok
        ? Object.freeze({
          providerId: resolved.value.providerId,
          materialKind: resolved.value.materialKind,
          currentVersionId: resolved.value.currentVersionId,
          usage: prepared.value.access.usage,
        })
        : undefined,
    });
    return resolved;
  }

  private async getScopedSecretProviderMaterialMetadata(
    request: ScopedSecretProviderMaterialRequestBase,
    ownerInput: SecretScopeOwner,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    const prepared = await this.prepareRequest(request, ownerInput, SecretAccessActions.readMetadata);
    if (!prepared.ok) {
      return prepared;
    }

    const input: ResolveSecretProviderMaterialMetadataInput = Object.freeze({
      selector: Object.freeze({
        providerId: prepared.value.providerId,
        secretId: prepared.value.secretId,
        scope: prepared.value.owner,
        materialKind: prepared.value.materialKind,
      }),
      access: prepared.value.access,
    });

    const metadata = await this.dependencies.secretProviderResolutionPort.resolveSecretProviderMaterialMetadata(input);
    await this.emitOperationFromResolutionResult({
      action: SecretAccessActions.readMetadata,
      actor: request.caller,
      target: prepared.value.owner,
      secretId: prepared.value.secretId,
      operationKey: prepared.value.access.operationKey,
      occurredAt: prepared.value.access.occurredAt,
      serviceIdentity: prepared.value.access.serviceIdentity,
      result: metadata,
      details: metadata.ok
        ? Object.freeze({
          providerId: metadata.value.providerId,
          materialKind: metadata.value.materialKind,
          backendKind: metadata.value.backend.backendKind,
          hasCurrentVersion: Boolean(metadata.value.rotation.currentVersionId),
          usage: prepared.value.access.usage,
        })
        : undefined,
    });
    return metadata;
  }

  private async scopedSecretProviderMaterialExists(
    request: ScopedSecretProviderMaterialRequestBase,
    ownerInput: SecretScopeOwner,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    const prepared = await this.prepareRequest(request, ownerInput, SecretAccessActions.readMetadata);
    if (!prepared.ok) {
      return prepared;
    }

    const input: ResolveSecretProviderMaterialExistenceInput = Object.freeze({
      selector: Object.freeze({
        providerId: prepared.value.providerId,
        secretId: prepared.value.secretId,
        scope: prepared.value.owner,
        materialKind: prepared.value.materialKind,
      }),
      access: prepared.value.access,
    });

    const existence = await this.dependencies.secretProviderResolutionPort.secretProviderMaterialExists(input);
    await this.emitOperationFromResolutionResult({
      action: SecretAccessActions.readMetadata,
      actor: request.caller,
      target: prepared.value.owner,
      secretId: prepared.value.secretId,
      operationKey: prepared.value.access.operationKey,
      occurredAt: prepared.value.access.occurredAt,
      serviceIdentity: prepared.value.access.serviceIdentity,
      result: existence,
      statusOverride: existence.ok && !existence.value.exists ? "missing" : undefined,
      details: existence.ok
        ? Object.freeze({
          providerId: prepared.value.providerId,
          materialKind: prepared.value.materialKind,
          exists: existence.value.exists,
          usage: prepared.value.access.usage,
        })
        : undefined,
    });
    return existence;
  }

  private async prepareRequest(
    request: ScopedSecretProviderMaterialRequestBase,
    ownerInput: SecretScopeOwner,
    action: SecretAccessAction,
  ): Promise<SecretServiceResult<{
    readonly owner: SecretScopeOwner;
    readonly providerId: string;
    readonly secretId: string;
    readonly materialKind: SecretProviderMaterialKind;
    readonly access: ResolveSecretProviderMaterialInput["access"];
  }>> {
    const actorId = normalizeRequired(request.caller?.actorId);
    if (!actorId) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "missing-actorId",
        actor: request.caller,
        secretId: request.secretId,
        target: ownerInput,
        occurredAt: this.now().toISOString(),
        serviceIdentity: request.access?.serviceIdentity,
      });
      return invalidRequest("caller.actorId is required.");
    }

    const providerId = normalizeRequired(request.providerId);
    if (!providerId) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "missing-providerId",
        actor: request.caller,
        secretId: request.secretId,
        target: ownerInput,
        occurredAt: this.now().toISOString(),
        serviceIdentity: request.access?.serviceIdentity,
      });
      return invalidRequest("providerId is required.");
    }

    const secretId = normalizeRequired(request.secretId);
    if (!secretId) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "missing-secretId",
        actor: request.caller,
        secretId: request.secretId,
        target: ownerInput,
        occurredAt: this.now().toISOString(),
        operationKey: request.access?.operationKey,
        serviceIdentity: request.access?.serviceIdentity,
      });
      return invalidRequest("secretId is required.");
    }

    const operationKey = normalizeRequired(request.access?.operationKey);
    if (!operationKey) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "missing-operationKey",
        actor: request.caller,
        secretId,
        target: ownerInput,
        occurredAt: this.now().toISOString(),
        serviceIdentity: request.access?.serviceIdentity,
      });
      return invalidRequest("access.operationKey is required.");
    }

    const serviceIdentity = normalizeRequired(request.access?.serviceIdentity);
    if (!serviceIdentity) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "missing-serviceIdentity",
        actor: request.caller,
        secretId,
        target: ownerInput,
        operationKey,
        occurredAt: this.now().toISOString(),
      });
      return invalidRequest("access.serviceIdentity is required.");
    }

    const usage = normalizeRequired(request.access?.usage);
    if (!usage) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "missing-usage",
        actor: request.caller,
        secretId,
        target: ownerInput,
        operationKey,
        occurredAt: this.now().toISOString(),
        serviceIdentity,
      });
      return invalidRequest("access.usage is required.");
    }

    const occurredAt = normalizeTimestamp(request.access?.occurredAt, this.now);
    if (!occurredAt) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "invalid-occurredAt",
        actor: request.caller,
        secretId,
        target: ownerInput,
        operationKey,
        occurredAt: this.now().toISOString(),
        serviceIdentity,
      });
      return invalidRequest("access.occurredAt must be a valid timestamp when provided.");
    }

    let owner: SecretScopeOwner;
    try {
      owner = createSecretScopeOwner(ownerInput);
    } catch (error) {
      await this.emitOperationEvent({
        action,
        status: "rejected",
        reasonCode: "invalid-owner",
        actor: request.caller,
        secretId,
        target: ownerInput,
        operationKey,
        occurredAt,
        serviceIdentity,
      });
      return invalidRequest(toErrorMessage(error));
    }

    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action,
      actor: Object.freeze({
        ...request.caller,
        actorId,
      }),
      owner,
      occurredAt,
    });
    await this.emitAccessDecisionEvent({
      action,
      actor: request.caller,
      target: owner,
      secretId,
      operationKey,
      occurredAt: decision.occurredAt,
      decision: decision.allowed ? "allowed" : "denied",
      reason: decision.reason,
      serviceIdentity,
      details: Object.freeze({
        providerId,
        materialKind: request.materialKind,
      }),
    });

    if (!decision.allowed) {
      await this.emitOperationEvent({
        action,
        status: "denied",
        reasonCode: decision.reason,
        actor: request.caller,
        secretId,
        target: owner,
        operationKey,
        occurredAt: decision.occurredAt,
        serviceIdentity,
        details: Object.freeze({
          providerId,
          materialKind: request.materialKind,
        }),
      });
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Scoped secret provider material access denied (${decision.reason}).`,
          details: Object.freeze({
            action,
            scope: owner.scope,
            workspaceId: owner.workspaceId,
            userIdentityId: owner.userIdentityId,
          }),
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        owner,
        providerId,
        secretId,
        materialKind: request.materialKind,
        access: Object.freeze({
          operationKey,
          serviceIdentity,
          usage,
          justification: normalizeOptional(request.access.justification),
          occurredAt,
        }),
      }),
    };
  }

  private async emitAccessDecisionEvent(input: {
    readonly action: SecretAccessAction;
    readonly actor: SecretAccessActor;
    readonly target: SecretScopeOwner;
    readonly secretId: string;
    readonly operationKey: string;
    readonly occurredAt: string;
    readonly decision: "allowed" | "denied";
    readonly reason: string;
    readonly serviceIdentity: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    try {
      await this.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.accessDecision,
        action: input.action,
        decision: input.decision,
        reason: input.reason,
        operationKey: input.operationKey,
        serviceIdentity: input.serviceIdentity,
        actor: toAuditActor(input.actor),
        target: toAuditTarget({
          secretId: input.secretId,
          owner: input.target,
        }),
        occurredAt: input.occurredAt,
        details: input.details,
      }));
    } catch {
      // Audit failures remain best-effort and must not block runtime secret resolution.
    }
  }

  private async emitOperationEvent(input: {
    readonly action: SecretAccessAction;
    readonly status: SecretAuditOperationStatus;
    readonly reasonCode: string;
    readonly actor: SecretAccessActor;
    readonly secretId?: string;
    readonly target: SecretScopeOwner;
    readonly occurredAt: string;
    readonly operationKey?: string;
    readonly serviceIdentity?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    try {
      await this.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.operation,
        operation: input.action,
        status: input.status,
        reasonCode: input.reasonCode,
        operationKey: input.operationKey,
        serviceIdentity: input.serviceIdentity,
        actor: toAuditActor(input.actor),
        target: toAuditTarget({
          secretId: input.secretId,
          owner: input.target,
        }),
        occurredAt: input.occurredAt,
        details: input.details,
      }));
    } catch {
      // Audit failures remain best-effort and must not block runtime secret resolution.
    }
  }

  private async emitOperationFromResolutionResult<TValue>(input: {
    readonly action: SecretAccessAction;
    readonly actor: SecretAccessActor;
    readonly target: SecretScopeOwner;
    readonly secretId: string;
    readonly operationKey: string;
    readonly occurredAt: string;
    readonly serviceIdentity: string;
    readonly result: SecretServiceResult<TValue>;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly statusOverride?: SecretAuditOperationStatus;
  }): Promise<void> {
    const outcome = input.statusOverride ?? resolveResolutionOperationStatus(input.result);
    const reasonCode = resolveResolutionReasonCode(input.result, outcome);
    await this.emitOperationEvent({
      action: input.action,
      status: outcome,
      reasonCode,
      actor: input.actor,
      secretId: input.secretId,
      target: input.target,
      operationKey: input.operationKey,
      occurredAt: input.occurredAt,
      serviceIdentity: input.serviceIdentity,
      details: input.result.ok
        ? input.details
        : Object.freeze({
          ...(input.details ?? {}),
          errorCode: input.result.error.code,
        }),
    });
  }
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

function invalidRequest(message: string): SecretServiceResult<never> {
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
  return "Invalid scoped provider material request.";
}

class NoOpScopedSecretAccessAuditPort implements ISecretAccessAuditPort {
  public async recordSecretAuditEvent(): Promise<void> {
    // no-op by design
  }
}

function toAuditActor(actor: SecretAccessActor) {
  return Object.freeze({
    actorId: actor.actorId,
    actorType: actor.actorType,
    workspaceId: actor.workspaceId,
    userIdentityId: actor.userIdentityId,
  });
}

function toAuditTarget(input: {
  readonly secretId?: string;
  readonly owner: SecretScopeOwner;
}) {
  return Object.freeze({
    secretId: input.secretId,
    scope: input.owner.scope,
    workspaceId: input.owner.workspaceId,
    userIdentityId: input.owner.userIdentityId,
  });
}

function resolveResolutionOperationStatus<TValue>(
  result: SecretServiceResult<TValue>,
): SecretAuditOperationStatus {
  if (result.ok) {
    return "succeeded";
  }

  switch (result.error.code) {
    case SecretServiceErrorCodes.notFound:
      return "missing";
    case SecretServiceErrorCodes.accessDenied:
      return "denied";
    case SecretServiceErrorCodes.invalidRequest:
    case SecretServiceErrorCodes.invalidState:
      return "rejected";
    case SecretServiceErrorCodes.conflict:
      return "conflict";
    default:
      return "failed";
  }
}

function resolveResolutionReasonCode<TValue>(
  result: SecretServiceResult<TValue>,
  status: SecretAuditOperationStatus,
): string {
  if (result.ok) {
    return status === "missing"
      ? "secret-provider-material-missing"
      : "operation-succeeded";
  }

  return result.error.code;
}
