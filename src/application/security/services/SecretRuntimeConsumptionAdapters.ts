import {
  SecretAccessActions,
  SecretActorTypes,
  SecretScopes,
  createSecretScopeOwner,
  type SecretAccessActor,
} from "../../../domain/security/SecretDomain";
import type {
  RetrieveSecretPlaintextResult,
  SecretRuntimeResolutionUseCaseContracts,
  SecretServiceResult,
} from "../use-cases/SecretManagementServiceContracts";

export interface ResolveWorkspaceProviderCredentialRequest {
  readonly workspaceId: string;
  readonly providerId: string;
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolveUserPersonalApiKeyRequest {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly providerId: string;
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolveServerSigningCredentialRequest {
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly signingPurpose: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolvedRuntimeSecretCredential extends RetrieveSecretPlaintextResult {
  readonly credential: string;
}

export interface ISecretRuntimeConsumptionAdapters {
  resolveWorkspaceProviderCredential(
    request: ResolveWorkspaceProviderCredentialRequest,
  ): Promise<SecretServiceResult<ResolvedRuntimeSecretCredential>>;
  resolveUserPersonalApiKey(
    request: ResolveUserPersonalApiKeyRequest,
  ): Promise<SecretServiceResult<ResolvedRuntimeSecretCredential>>;
  resolveServerSigningCredential(
    request: ResolveServerSigningCredentialRequest,
  ): Promise<SecretServiceResult<ResolvedRuntimeSecretCredential>>;
}

export class SecretRuntimeConsumptionAdapters implements ISecretRuntimeConsumptionAdapters {
  public constructor(
    private readonly runtimeResolutionUseCase: SecretRuntimeResolutionUseCaseContracts,
  ) {}

  public async resolveWorkspaceProviderCredential(
    request: ResolveWorkspaceProviderCredentialRequest,
  ): Promise<SecretServiceResult<ResolvedRuntimeSecretCredential>> {
    const scope = createSecretScopeOwner({
      scope: SecretScopes.workspace,
      workspaceId: request.workspaceId,
    });
    const actor = createRuntimeActor({
      actorId: request.serviceIdentity,
      actorType: SecretActorTypes.workspaceService,
      workspaceId: request.workspaceId,
    });

    const result = await this.runtimeResolutionUseCase.retrieveSecretPlaintextForRuntime({
      actor,
      secretId: request.secretId,
      operationKey: request.operationKey,
      runtimeContext: {
        serviceIdentity: request.serviceIdentity,
        scope,
        justification: normalizeOptional(request.justification)
          ?? `resolve workspace provider credential for '${request.providerId}'`,
      },
      occurredAt: request.occurredAt,
    });

    return toCredentialResult(result);
  }

  public async resolveUserPersonalApiKey(
    request: ResolveUserPersonalApiKeyRequest,
  ): Promise<SecretServiceResult<ResolvedRuntimeSecretCredential>> {
    const scope = createSecretScopeOwner({
      scope: SecretScopes.user,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
    });
    const actor = createRuntimeActor({
      actorId: request.serviceIdentity,
      actorType: SecretActorTypes.workspaceService,
      workspaceId: request.workspaceId,
      userIdentityId: request.userIdentityId,
    });

    const result = await this.runtimeResolutionUseCase.retrieveSecretPlaintextForRuntime({
      actor,
      secretId: request.secretId,
      operationKey: request.operationKey,
      runtimeContext: {
        serviceIdentity: request.serviceIdentity,
        scope,
        justification: normalizeOptional(request.justification)
          ?? `resolve user personal API key for '${request.providerId}'`,
      },
      occurredAt: request.occurredAt,
    });

    return toCredentialResult(result);
  }

  public async resolveServerSigningCredential(
    request: ResolveServerSigningCredentialRequest,
  ): Promise<SecretServiceResult<ResolvedRuntimeSecretCredential>> {
    const scope = createSecretScopeOwner({
      scope: SecretScopes.server,
    });
    const actor = createRuntimeActor({
      actorId: request.serviceIdentity,
      actorType: SecretActorTypes.serverRuntime,
    });

    const result = await this.runtimeResolutionUseCase.retrieveSecretPlaintextForRuntime({
      actor,
      secretId: request.secretId,
      operationKey: request.operationKey,
      runtimeContext: {
        serviceIdentity: request.serviceIdentity,
        scope,
        justification: normalizeOptional(request.justification)
          ?? `resolve server signing credential for '${request.signingPurpose}'`,
      },
      occurredAt: request.occurredAt,
    });

    return toCredentialResult(result);
  }
}

function createRuntimeActor(input: {
  readonly actorId: string;
  readonly actorType: SecretAccessActor["actorType"];
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}): SecretAccessActor {
  return Object.freeze({
    actorId: input.actorId,
    actorType: input.actorType,
    workspaceId: normalizeOptional(input.workspaceId),
    userIdentityId: normalizeOptional(input.userIdentityId),
    grantedActions: Object.freeze([SecretAccessActions.retrievePlaintext]),
  });
}

function toCredentialResult(
  result: SecretServiceResult<RetrieveSecretPlaintextResult>,
): SecretServiceResult<ResolvedRuntimeSecretCredential> {
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: Object.freeze({
      ...result.value,
      credential: result.value.plaintext,
    }),
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
