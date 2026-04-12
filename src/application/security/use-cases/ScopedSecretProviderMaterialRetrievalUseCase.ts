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
  readonly now?: () => Date;
}

export class ScopedSecretProviderMaterialRetrievalUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: ScopedSecretProviderMaterialRetrievalUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
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

    return this.dependencies.secretProviderResolutionPort.resolveSecretProviderMaterial(input);
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

    return this.dependencies.secretProviderResolutionPort.resolveSecretProviderMaterialMetadata(input);
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

    return this.dependencies.secretProviderResolutionPort.secretProviderMaterialExists(input);
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
      return invalidRequest("caller.actorId is required.");
    }

    const providerId = normalizeRequired(request.providerId);
    if (!providerId) {
      return invalidRequest("providerId is required.");
    }

    const secretId = normalizeRequired(request.secretId);
    if (!secretId) {
      return invalidRequest("secretId is required.");
    }

    const operationKey = normalizeRequired(request.access?.operationKey);
    if (!operationKey) {
      return invalidRequest("access.operationKey is required.");
    }

    const serviceIdentity = normalizeRequired(request.access?.serviceIdentity);
    if (!serviceIdentity) {
      return invalidRequest("access.serviceIdentity is required.");
    }

    const usage = normalizeRequired(request.access?.usage);
    if (!usage) {
      return invalidRequest("access.usage is required.");
    }

    const occurredAt = normalizeTimestamp(request.access?.occurredAt, this.now);
    if (!occurredAt) {
      return invalidRequest("access.occurredAt must be a valid timestamp when provided.");
    }

    let owner: SecretScopeOwner;
    try {
      owner = createSecretScopeOwner(ownerInput);
    } catch (error) {
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

    if (!decision.allowed) {
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
