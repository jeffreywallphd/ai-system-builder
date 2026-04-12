import { SecretAccessActions, SecretActorTypes, SecretScopes } from "@domain/security/SecretDomain";
import {
  SystemSecretBootstrapStates,
  bootstrapSystemSecretsFromEnvironment,
} from "./SystemSecretBootstrapService";
import type { ServerComposedSecretService } from "./SecretServiceComposition";
import {
  type SecretProviderMaterialMetadataDto,
  SecretServiceDiagnosticSeverities,
  SecretServiceHealthStates,
  type SecretServiceHealthFlagsDto,
  type SecretServiceHealthState,
  type SecretServiceHealthViewDto,
  type SecretServiceOperationalDiagnosticDto,
  type SecretServiceOperationalDiagnosticsViewDto,
} from "@shared/dto/security/SecretServiceOperationalDiagnosticsDtos";

const SECRET_BOOTSTRAP_MIGRATION_ENV_KEY = "AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV";

export interface SecretServiceOperationalDiagnosticsProviderInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
  readonly now?: () => Date;
}

export interface ISecretServiceOperationalDiagnosticsProvider {
  collectDiagnostics(): Promise<SecretServiceOperationalDiagnosticsViewDto>;
}

export class SecretServiceOperationalDiagnosticsProvider implements ISecretServiceOperationalDiagnosticsProvider {
  private readonly now: () => Date;

  public constructor(private readonly input: SecretServiceOperationalDiagnosticsProviderInput) {
    this.now = input.now ?? (() => new Date());
  }

  public async collectDiagnostics(): Promise<SecretServiceOperationalDiagnosticsViewDto> {
    const checkedAt = this.now().toISOString();
    const diagnostics: SecretServiceOperationalDiagnosticDto[] = [];

    const repositoryReachable = await this.checkRepositoryReachable(diagnostics);
    const bootstrapResult = await bootstrapSystemSecretsFromEnvironment({
      env: Object.freeze({
        ...this.input.env,
        [SECRET_BOOTSTRAP_MIGRATION_ENV_KEY]: "false",
      }),
      secretService: this.input.secretService,
      now: this.now,
    });

    const bootstrapDiagnostics = bootstrapResult.diagnostics.map((diagnostic) => Object.freeze({
      code: diagnostic.code,
      severity: diagnostic.severity === "error"
        ? SecretServiceDiagnosticSeverities.error
        : SecretServiceDiagnosticSeverities.warning,
      message: diagnostic.message,
      secretId: diagnostic.secretId,
    }));

    diagnostics.push(...bootstrapDiagnostics);

    const encryptionMaterialAvailable = this.input.secretService.status.configured;
    if (!encryptionMaterialAvailable) {
      diagnostics.push(Object.freeze({
        code: "secret-encryption-unavailable",
        severity: SecretServiceDiagnosticSeverities.warning,
        message: "Secret encryption material is not configured.",
      }));
    }

    const bootstrapSecretsHealthy = bootstrapResult.state === SystemSecretBootstrapStates.ready;
    const runtimeDependenciesHealthy = encryptionMaterialAvailable && bootstrapSecretsHealthy;
    const healthFlags: SecretServiceHealthFlagsDto = Object.freeze({
      encryptionMaterialAvailable,
      repositoryReachable,
      bootstrapSecretsHealthy,
      runtimeDependenciesHealthy,
    });

    const state = resolveHealthState({
      repositoryReachable,
      encryptionMaterialAvailable,
      bootstrapSecretsHealthy,
    });

    return Object.freeze({
      state,
      checkedAt,
      healthFlags,
      diagnostics: Object.freeze(diagnostics),
      bootstrap: Object.freeze({
        requiredSecretIds: bootstrapResult.requiredSecretIds,
        diagnostics: Object.freeze(bootstrapDiagnostics),
        materialMetadata: Object.freeze(
          bootstrapResult.materialMetadata.map((item) => toSecretProviderMaterialMetadataDto(item)),
        ),
      }),
    });
  }

  private async checkRepositoryReachable(diagnostics: SecretServiceOperationalDiagnosticDto[]): Promise<boolean> {
    const outcome = await this.input.secretService.listSecretsUseCase.execute({
      actor: Object.freeze({
        actorId: "system:secret-health-check",
        actorType: SecretActorTypes.serverAdmin,
        grantedActions: Object.freeze([SecretAccessActions.list]),
      }),
      owner: Object.freeze({
        scope: SecretScopes.server,
      }),
      includeDisabled: true,
      includeArchived: true,
      includeSoftDeleted: true,
      limit: 1,
      offset: 0,
    });

    if (outcome.ok) {
      return true;
    }

    diagnostics.push(Object.freeze({
      code: "secret-repository-unreachable",
      severity: SecretServiceDiagnosticSeverities.error,
      message: "Secret metadata repository check failed.",
    }));
    return false;
  }
}

export function toSecretServiceHealthView(
  diagnostics: SecretServiceOperationalDiagnosticsViewDto,
): SecretServiceHealthViewDto {
  return Object.freeze({
    state: diagnostics.state,
    checkedAt: diagnostics.checkedAt,
    healthFlags: diagnostics.healthFlags,
  });
}

function resolveHealthState(input: {
  readonly repositoryReachable: boolean;
  readonly encryptionMaterialAvailable: boolean;
  readonly bootstrapSecretsHealthy: boolean;
}): SecretServiceHealthState {
  if (!input.repositoryReachable) {
    return SecretServiceHealthStates.unhealthy;
  }

  if (!input.encryptionMaterialAvailable || !input.bootstrapSecretsHealthy) {
    return SecretServiceHealthStates.degraded;
  }

  return SecretServiceHealthStates.healthy;
}

function toSecretProviderMaterialMetadataDto(input: {
  readonly providerId: string;
  readonly secretId: string;
  readonly scope: {
    readonly scope: "server" | "workspace" | "user";
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  };
  readonly materialKind: string;
  readonly backend: {
    readonly backendId: string;
    readonly backendKind: string;
  };
  readonly reference: {
    readonly secretId: string;
    readonly name: string;
    readonly scope: "server" | "workspace" | "user";
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
    readonly kind: string;
    readonly state: string;
    readonly currentVersionId?: string;
    readonly metadata: {
      readonly displayName?: string;
      readonly description?: string;
      readonly tags: ReadonlyArray<string>;
      readonly labels: Readonly<Record<string, string>>;
    };
    readonly updatedAt: string;
  };
  readonly timestamps: {
    readonly createdAt?: string;
    readonly updatedAt: string;
  };
  readonly rotation: {
    readonly status: string;
    readonly currentVersionId?: string;
  };
  readonly policyFlags: {
    readonly metadataSafeForDiagnostics: true;
    readonly plaintextAccessRequiresDedicatedRetrievalFlow: true;
    readonly failFastRequiredOnStartup?: boolean;
  };
}): SecretProviderMaterialMetadataDto {
  return Object.freeze({
    providerId: input.providerId,
    secretId: input.secretId,
    scope: input.scope.scope,
    workspaceId: input.scope.workspaceId,
    userIdentityId: input.scope.userIdentityId,
    materialKind: input.materialKind,
    backend: Object.freeze({
      backendId: input.backend.backendId,
      backendKind: input.backend.backendKind,
    }),
    reference: Object.freeze({
      secretId: input.reference.secretId,
      name: input.reference.name,
      scope: input.reference.scope,
      workspaceId: input.reference.workspaceId,
      userIdentityId: input.reference.userIdentityId,
      kind: input.reference.kind,
      state: input.reference.state,
      currentVersionId: input.reference.currentVersionId,
      metadata: Object.freeze({
        displayName: input.reference.metadata.displayName,
        description: input.reference.metadata.description,
        tags: Object.freeze([...input.reference.metadata.tags]),
        labels: Object.freeze({ ...input.reference.metadata.labels }),
      }),
      updatedAt: input.reference.updatedAt,
    }),
    timestamps: Object.freeze({
      createdAt: input.timestamps.createdAt,
      updatedAt: input.timestamps.updatedAt,
    }),
    rotation: Object.freeze({
      status: input.rotation.status,
      currentVersionId: input.rotation.currentVersionId,
    }),
    policyFlags: Object.freeze({
      metadataSafeForDiagnostics: true,
      plaintextAccessRequiresDedicatedRetrievalFlow: true,
      failFastRequiredOnStartup: input.policyFlags.failFastRequiredOnStartup,
    }),
  });
}

