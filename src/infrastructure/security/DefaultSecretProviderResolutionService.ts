import {
  SecretAccessActions,
  SecretActorTypes,
  SecretScopes,
  type SecretAccessActor,
  type SecretReference,
  type SecretScopeOwner,
} from "@domain/security/SecretDomain";
import type {
  CreateSecretResult,
  CreateSecretRequest,
  GetSecretMetadataRequest,
  SecretServiceResult,
} from "@application/security/use-cases/SecretManagementServiceContracts";
import { SecretServiceErrorCodes } from "@application/security/use-cases/SecretManagementServiceContracts";
import type { SecretRuntimeConsumptionAdapters } from "@application/security/services/SecretRuntimeConsumptionAdapters";
import {
  SecretProviderBootstrapOutcomes,
  type ISecretProviderMaterialResolutionPort,
  type ResolveSecretProviderMaterialExistenceInput,
  type ResolveSecretProviderMaterialInput,
  type ResolveSecretProviderMaterialMetadataInput,
  type ResolvedSecretProviderMaterialValue,
  type SecretProviderBootstrapResult,
  type SecretProviderMaterialBootstrapInput,
  type SecretProviderMaterialReference,
} from "@application/security/ports/SecretProviderPorts";
import {
  DurableServerSecretStoreBackend,
  type DurableServerSecretStoreBackendDependencies,
} from "@infrastructure/security/secrets/DurableServerSecretStoreBackend";
import { LocalUserSecureSecretStoreBackend } from "@infrastructure/security/secrets/LocalUserSecureSecretStoreBackend";

export interface DefaultSecretProviderResolutionServiceDependencies {
  readonly runtimeSecretConsumptionAdapters: SecretRuntimeConsumptionAdapters;
  readonly getSecretMetadata: (request: GetSecretMetadataRequest) => Promise<SecretServiceResult<SecretReference>>;
  readonly createSecret: (request: CreateSecretRequest) => Promise<SecretServiceResult<CreateSecretResult>>;
  readonly initializeServerSecretStore?: () => Promise<void>;
  readonly serverSecretStoreBackend?: DurableServerSecretStoreBackend;
  readonly localUserSecureSecretStoreBackend?: LocalUserSecureSecretStoreBackend;
}

export class DefaultSecretProviderResolutionService implements ISecretProviderMaterialResolutionPort {
  private readonly serverSecretStoreBackend: DurableServerSecretStoreBackend;
  private readonly localUserSecureSecretStoreBackend: LocalUserSecureSecretStoreBackend | undefined;

  public constructor(private readonly dependencies: DefaultSecretProviderResolutionServiceDependencies) {
    this.serverSecretStoreBackend = dependencies.serverSecretStoreBackend
      ?? new DurableServerSecretStoreBackend(toServerSecretStoreBackendDependencies(dependencies));
    this.localUserSecureSecretStoreBackend = dependencies.localUserSecureSecretStoreBackend;
  }

  public async resolveSecretProviderMaterial(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    const scope = input.selector.scope.scope;
    const justification = normalizeOptional(input.access.justification)
      ?? defaultResolutionJustification(input);

    if (scope === SecretScopes.server) {
      return this.serverSecretStoreBackend.resolveServerMaterial({
        selector: input.selector,
        access: Object.freeze({
          ...input.access,
          justification,
        }),
      });
    }

    if (scope === SecretScopes.workspace) {
      const result = await this.dependencies.runtimeSecretConsumptionAdapters.resolveWorkspaceProviderCredential({
        workspaceId: input.selector.scope.workspaceId as string,
        providerId: input.selector.providerId,
        secretId: input.selector.secretId,
        operationKey: input.access.operationKey,
        serviceIdentity: input.access.serviceIdentity,
        justification,
        occurredAt: input.access.occurredAt,
      });
      if (!result.ok) {
        return result;
      }
      return {
        ok: true,
        value: Object.freeze({
          providerId: input.selector.providerId,
          secretId: result.value.secretId,
          currentVersionId: result.value.currentVersionId,
          scope: result.value.scope,
          materialKind: input.selector.materialKind,
          rawValue: result.value.credential,
        }),
      };
    }

    const localResult = await this.resolveLocalUserMaterialIfConfigured({
      selector: input.selector,
      access: Object.freeze({
        ...input.access,
        justification,
      }),
    });
    if (localResult) {
      if (localResult.ok || localResult.error.code !== SecretServiceErrorCodes.notFound) {
        return localResult;
      }
    }

    return this.resolveManagedUserMaterial({
      selector: input.selector,
      access: Object.freeze({
        ...input.access,
        justification,
      }),
    });
  }

  public async resolveSecretProviderMaterialMetadata(
    input: ResolveSecretProviderMaterialMetadataInput,
  ): Promise<SecretServiceResult<SecretProviderMaterialReference>> {
    if (input.selector.scope.scope === SecretScopes.server) {
      return this.serverSecretStoreBackend.resolveServerMaterialMetadata(input);
    }

    if (input.selector.scope.scope === SecretScopes.user && this.localUserSecureSecretStoreBackend) {
      const local = await this.localUserSecureSecretStoreBackend.resolveUserMaterialMetadata(input);
      if (local.ok || local.error.code !== SecretServiceErrorCodes.notFound) {
        return local;
      }
    }

    const metadata = await this.dependencies.getSecretMetadata({
      actor: createMetadataActor({
        scope: input.selector.scope,
        actorId: input.access.serviceIdentity,
      }),
      secretId: input.selector.secretId,
      occurredAt: input.access.occurredAt,
    });

    if (!metadata.ok) {
      return metadata;
    }

    return {
      ok: true,
      value: Object.freeze({
        providerId: input.selector.providerId,
        secretId: input.selector.secretId,
        scope: input.selector.scope,
        materialKind: input.selector.materialKind,
        reference: metadata.value,
      }),
    };
  }

  public async secretProviderMaterialExists(
    input: ResolveSecretProviderMaterialExistenceInput,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    if (input.selector.scope.scope === SecretScopes.server) {
      return this.serverSecretStoreBackend.serverMaterialExists(input);
    }

    const metadata = await this.resolveSecretProviderMaterialMetadata({
      selector: input.selector,
      access: input.access,
    });
    if (metadata.ok) {
      return {
        ok: true,
        value: Object.freeze({
          exists: true,
        }),
      };
    }

    if (metadata.error.code === SecretServiceErrorCodes.notFound) {
      return {
        ok: true,
        value: Object.freeze({
          exists: false,
        }),
      };
    }

    return metadata;
  }

  public async bootstrapSecretProviderMaterial(
    input: SecretProviderMaterialBootstrapInput,
  ): Promise<SecretServiceResult<SecretProviderBootstrapResult>> {
    if (input.selector.scope.scope === SecretScopes.server) {
      return this.serverSecretStoreBackend.bootstrapServerMaterial(input);
    }

    if (input.selector.scope.scope === SecretScopes.user && this.localUserSecureSecretStoreBackend) {
      const local = await this.localUserSecureSecretStoreBackend.bootstrapUserMaterial(input);
      if (local.ok || local.error.code !== SecretServiceErrorCodes.notFound) {
        return local;
      }
    }

    const metadata = await this.resolveSecretProviderMaterialMetadata({
      selector: input.selector,
      access: input.access,
    });
    if (metadata.ok) {
      return {
        ok: true,
        value: Object.freeze({
          outcome: SecretProviderBootstrapOutcomes.existing,
          reference: metadata.value,
        }),
      };
    }

    if (metadata.error.code !== SecretServiceErrorCodes.notFound) {
      return metadata;
    }

    const created = await this.dependencies.createSecret({
      actor: createBootstrapActor({
        scope: input.selector.scope,
        actorId: input.access.serviceIdentity,
      }),
      operationKey: input.access.operationKey,
      secretId: input.selector.secretId,
      name: input.name,
      owner: input.selector.scope,
      kind: input.kind,
      plaintext: input.plaintext,
      metadata: input.metadata,
      createdAt: input.access.occurredAt,
    });
    if (!created.ok) {
      if (created.error.code === SecretServiceErrorCodes.conflict) {
        const existing = await this.resolveSecretProviderMaterialMetadata({
          selector: input.selector,
          access: input.access,
        });
        if (existing.ok) {
          return {
            ok: true,
            value: Object.freeze({
              outcome: SecretProviderBootstrapOutcomes.existing,
              reference: existing.value,
            }),
          };
        }
      }
      return created;
    }

    const reference = toMaterialReference(input, created.value.secret);
    return {
      ok: true,
      value: Object.freeze({
        outcome: SecretProviderBootstrapOutcomes.created,
        reference,
      }),
    };
  }

  private async resolveLocalUserMaterialIfConfigured(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue> | undefined> {
    if (input.selector.scope.scope !== SecretScopes.user || !this.localUserSecureSecretStoreBackend) {
      return undefined;
    }

    return this.localUserSecureSecretStoreBackend.resolveUserMaterial(input);
  }

  private async resolveManagedUserMaterial(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    const result = await this.dependencies.runtimeSecretConsumptionAdapters.resolveUserPersonalApiKey({
      userIdentityId: input.selector.scope.userIdentityId as string,
      workspaceId: input.selector.scope.workspaceId,
      providerId: input.selector.providerId,
      secretId: input.selector.secretId,
      operationKey: input.access.operationKey,
      serviceIdentity: input.access.serviceIdentity,
      justification: input.access.justification,
      occurredAt: input.access.occurredAt,
    });
    if (!result.ok) {
      return result;
    }
    return {
      ok: true,
      value: Object.freeze({
        providerId: input.selector.providerId,
        secretId: result.value.secretId,
        currentVersionId: result.value.currentVersionId,
        scope: result.value.scope,
        materialKind: input.selector.materialKind,
        rawValue: result.value.credential,
      }),
    };
  }
}

function toServerSecretStoreBackendDependencies(
  dependencies: DefaultSecretProviderResolutionServiceDependencies,
): DurableServerSecretStoreBackendDependencies {
  return Object.freeze({
    runtimeSecretConsumptionAdapters: dependencies.runtimeSecretConsumptionAdapters,
    getSecretMetadata: dependencies.getSecretMetadata,
    createSecret: dependencies.createSecret,
    initialize: dependencies.initializeServerSecretStore,
  });
}

function toMaterialReference(
  input: SecretProviderMaterialBootstrapInput,
  reference: SecretProviderMaterialReference["reference"],
): SecretProviderMaterialReference {
  return Object.freeze({
    providerId: input.selector.providerId,
    secretId: input.selector.secretId,
    scope: input.selector.scope,
    materialKind: input.selector.materialKind,
    reference,
  });
}

function createMetadataActor(input: {
  readonly scope: SecretScopeOwner;
  readonly actorId: string;
}): SecretAccessActor {
  if (input.scope.scope === SecretScopes.server) {
    return Object.freeze({
      actorId: input.actorId,
      actorType: SecretActorTypes.serverAdmin,
      grantedActions: Object.freeze([SecretAccessActions.readMetadata]),
    });
  }

  if (input.scope.scope === SecretScopes.workspace) {
    return Object.freeze({
      actorId: input.actorId,
      actorType: SecretActorTypes.workspaceMember,
      workspaceId: input.scope.workspaceId,
      grantedActions: Object.freeze([SecretAccessActions.readMetadata]),
    });
  }

  return Object.freeze({
    actorId: input.actorId,
    actorType: SecretActorTypes.user,
    workspaceId: input.scope.workspaceId,
    userIdentityId: input.scope.userIdentityId,
    grantedActions: Object.freeze([SecretAccessActions.readMetadata]),
  });
}

function createBootstrapActor(input: {
  readonly scope: SecretScopeOwner;
  readonly actorId: string;
}): SecretAccessActor {
  if (input.scope.scope === SecretScopes.server) {
    return Object.freeze({
      actorId: input.actorId,
      actorType: SecretActorTypes.serverAdmin,
      grantedActions: Object.freeze([SecretAccessActions.create]),
    });
  }

  if (input.scope.scope === SecretScopes.workspace) {
    return Object.freeze({
      actorId: input.actorId,
      actorType: SecretActorTypes.workspaceMember,
      workspaceId: input.scope.workspaceId,
      grantedActions: Object.freeze([SecretAccessActions.create]),
    });
  }

  return Object.freeze({
    actorId: input.actorId,
    actorType: SecretActorTypes.user,
    workspaceId: input.scope.workspaceId,
    userIdentityId: input.scope.userIdentityId,
    grantedActions: Object.freeze([SecretAccessActions.create]),
  });
}

function defaultResolutionJustification(input: ResolveSecretProviderMaterialInput): string {
  const scope = input.selector.scope.scope;
  if (scope === SecretScopes.server) {
    return `resolve ${input.selector.materialKind} for provider '${input.selector.providerId}' in server scope`;
  }
  if (scope === SecretScopes.workspace) {
    return `resolve ${input.selector.materialKind} for provider '${input.selector.providerId}' in workspace scope`;
  }
  return `resolve ${input.selector.materialKind} for provider '${input.selector.providerId}' in user scope`;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
