import {
  SecretAccessActions,
  SecretActorTypes,
  SecretScopes,
  type SecretAccessActor,
  type SecretReference,
} from "@domain/security/SecretDomain";
import type { SecretRuntimeConsumptionAdapters } from "@application/security/services/SecretRuntimeConsumptionAdapters";
import type {
  CreateSecretRequest,
  CreateSecretResult,
  GetSecretMetadataRequest,
  SecretServiceResult,
} from "@application/security/use-cases/SecretManagementServiceContracts";
import { SecretServiceErrorCodes } from "@application/security/use-cases/SecretManagementServiceContracts";
import {
  SecretProviderMaterialBackendKinds,
  SecretProviderBootstrapOutcomes,
  SecretProviderMaterialRotationStatuses,
  SecretProviderMaterialKinds,
  type ResolveSecretProviderMaterialExistenceInput,
  type ResolveSecretProviderMaterialInput,
  type ResolveSecretProviderMaterialMetadataInput,
  type SecretProviderMaterialMetadata,
  type ResolvedSecretProviderMaterialValue,
  type SecretProviderBootstrapResult,
  type SecretProviderMaterialBootstrapInput,
} from "@application/security/ports/SecretProviderPorts";

export interface DurableServerSecretStoreBackendDependencies {
  readonly runtimeSecretConsumptionAdapters: SecretRuntimeConsumptionAdapters;
  readonly getSecretMetadata: (request: GetSecretMetadataRequest) => Promise<SecretServiceResult<SecretReference>>;
  readonly createSecret: (request: CreateSecretRequest) => Promise<SecretServiceResult<CreateSecretResult>>;
  readonly initialize?: () => Promise<void>;
}

export class DurableServerSecretStoreBackend {
  private initializationPromise: Promise<void> | undefined;
  private initializationError: unknown;

  public constructor(private readonly dependencies: DurableServerSecretStoreBackendDependencies) {}

  public async resolveServerMaterial(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    if (input.selector.scope.scope !== SecretScopes.server) {
      return createInvalidScopeResult();
    }
    const initialization = await this.ensureInitialized();
    if (!initialization.ok) {
      return initialization;
    }

    const result = await this.dependencies.runtimeSecretConsumptionAdapters.resolveServerSigningCredential({
      secretId: input.selector.secretId,
      operationKey: input.access.operationKey,
      serviceIdentity: input.access.serviceIdentity,
      signingPurpose: toServerSigningPurpose(input),
      justification: normalizeOptional(input.access.justification)
        ?? `resolve ${input.selector.materialKind} for provider '${input.selector.providerId}' in server scope`,
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

  public async resolveServerMaterialMetadata(
    input: ResolveSecretProviderMaterialMetadataInput,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    if (input.selector.scope.scope !== SecretScopes.server) {
      return createInvalidScopeResult();
    }
    const initialization = await this.ensureInitialized();
    if (!initialization.ok) {
      return initialization;
    }

    const metadata = await this.dependencies.getSecretMetadata({
      actor: createServerMetadataActor(input.access.serviceIdentity),
      secretId: input.selector.secretId,
      occurredAt: input.access.occurredAt,
    });
    if (!metadata.ok) {
      return metadata;
    }

    return {
      ok: true,
      value: toSecretProviderMaterialMetadata({
        selector: input.selector,
        reference: metadata.value,
        backendKind: SecretProviderMaterialBackendKinds.durableServerSecretStore,
      }),
    };
  }

  public async serverMaterialExists(
    input: ResolveSecretProviderMaterialExistenceInput,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    if (input.selector.scope.scope !== SecretScopes.server) {
      return createInvalidScopeResult();
    }
    const metadata = await this.resolveServerMaterialMetadata({
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

  public async bootstrapServerMaterial(
    input: SecretProviderMaterialBootstrapInput,
  ): Promise<SecretServiceResult<SecretProviderBootstrapResult>> {
    if (input.selector.scope.scope !== SecretScopes.server) {
      return createInvalidScopeResult();
    }
    const initialization = await this.ensureInitialized();
    if (!initialization.ok) {
      return initialization;
    }

    const metadata = await this.resolveServerMaterialMetadata({
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
      actor: createServerBootstrapActor(input.access.serviceIdentity),
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
        const existing = await this.resolveServerMaterialMetadata({
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

    return {
      ok: true,
      value: Object.freeze({
        outcome: SecretProviderBootstrapOutcomes.created,
        reference: toSecretProviderMaterialMetadata({
          selector: input.selector,
          reference: created.value.secret,
          backendKind: SecretProviderMaterialBackendKinds.durableServerSecretStore,
        }),
      }),
    };
  }

  private async ensureInitialized(): Promise<SecretServiceResult<{ readonly initialized: true }>> {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        if (this.dependencies.initialize) {
          await this.dependencies.initialize();
        }
      })().catch((error: unknown) => {
        this.initializationError = error;
        throw error;
      });
    }

    try {
      await this.initializationPromise;
    } catch {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.internal,
          message: "Durable server secret store backend initialization failed.",
          details: Object.freeze({
            reason: normalizeInitializationError(this.initializationError),
          }),
        },
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        initialized: true,
      }),
    };
  }
}

function createServerMetadataActor(actorId: string): SecretAccessActor {
  return Object.freeze({
    actorId,
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: Object.freeze([SecretAccessActions.readMetadata]),
  });
}

function createServerBootstrapActor(actorId: string): SecretAccessActor {
  return Object.freeze({
    actorId,
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: Object.freeze([SecretAccessActions.create]),
  });
}

function toServerSigningPurpose(input: ResolveSecretProviderMaterialInput): string {
  if (input.selector.materialKind === SecretProviderMaterialKinds.providerCredential) {
    return `provider-credential:${input.selector.providerId}`;
  }
  return input.access.usage;
}

function createInvalidScopeResult(): SecretServiceResult<never> {
  return {
    ok: false,
    error: {
      code: SecretServiceErrorCodes.invalidRequest,
      message: "Durable server secret store backend only supports server scope selectors.",
    },
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeInitializationError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toSecretProviderMaterialMetadata(input: {
  readonly selector: ResolveSecretProviderMaterialInput["selector"];
  readonly reference: SecretReference;
  readonly backendKind: typeof SecretProviderMaterialBackendKinds[keyof typeof SecretProviderMaterialBackendKinds];
}): SecretProviderMaterialMetadata {
  return Object.freeze({
    providerId: input.selector.providerId,
    secretId: input.selector.secretId,
    scope: input.selector.scope,
    materialKind: input.selector.materialKind,
    backend: Object.freeze({
      backendId: input.backendKind,
      backendKind: input.backendKind,
    }),
    reference: input.reference,
    timestamps: Object.freeze({
      updatedAt: input.reference.updatedAt,
    }),
    rotation: Object.freeze({
      status: toRotationStatus(input.reference.state),
      currentVersionId: input.reference.currentVersionId,
    }),
    policyFlags: Object.freeze({
      metadataSafeForDiagnostics: true,
      plaintextAccessRequiresDedicatedRetrievalFlow: true,
      failFastRequiredOnStartup: input.selector.materialKind === SecretProviderMaterialKinds.providerCredential
        || input.selector.materialKind === SecretProviderMaterialKinds.signingMaterial,
    }),
  });
}

function toRotationStatus(
  state: SecretReference["state"],
): typeof SecretProviderMaterialRotationStatuses[keyof typeof SecretProviderMaterialRotationStatuses] {
  if (state === "active") {
    return SecretProviderMaterialRotationStatuses.active;
  }
  if (state === "disabled") {
    return SecretProviderMaterialRotationStatuses.disabled;
  }
  if (state === "archived") {
    return SecretProviderMaterialRotationStatuses.archived;
  }
  if (state === "soft-deleted") {
    return SecretProviderMaterialRotationStatuses.softDeleted;
  }
  return SecretProviderMaterialRotationStatuses.unknown;
}
