import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  type SecretKind,
} from "@domain/security/SecretDomain";
import {
  SecurityMaterialCategories,
  SecurityMaterialDurabilityClasses,
  SecurityMaterialFallbackPolicies,
  SecurityMaterialLifecycleStages,
  SecurityMaterialRotationPostures,
  SecurityMaterialScopes,
  SecurityMaterialStartupRequirements,
  SecurityMaterialUsageContexts,
  createSecurityMaterialClassificationContract,
  isFailFastRequiredSecurityMaterial,
  resolveSecurityMaterialEnvironmentPolicy,
  type SecurityMaterialClassificationContract,
  type SecurityMaterialDurabilityClass,
  type SecurityMaterialFallbackPolicy,
  type SecurityMaterialLifecycleStage,
  type SecurityMaterialStartupRequirement,
} from "@application/security/contracts/SecurityMaterialClassificationContract";
import type { ServerComposedSecretService } from "./SecretServiceComposition";
import {
  ServerPlatformProviderIds,
  ServerPlatformSecretConsumers,
} from "./ServerPlatformSecretConsumers";
import type { IRuntimeSecurityMaterialResolverPort } from "@application/security/ports/SecurityMaterialResolutionPorts";

const SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS = Object.freeze({
  requiredSecretIds: "AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS",
  migrateLegacyEnvironmentValues: "AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV",
  openAiApiKey: "OPENAI_API_KEY",
  huggingFaceApiToken: "HUGGINGFACE_API_TOKEN",
  identitySessionSigningPrivateKey: "AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY",
});

interface SystemSecretDefinition {
  readonly secretId: string;
  readonly name: string;
  readonly kind: SecretKind;
  readonly classification: SecurityMaterialClassificationContract;
  readonly metadata: {
    readonly tags: ReadonlyArray<string>;
    readonly labels: Readonly<Record<string, string>>;
  };
  readonly runtimePurpose: string;
  readonly runtimeConsumer: "provider-credential" | "server-signing";
  readonly providerId?: "openai" | "huggingface";
  readonly legacyEnvironmentVariable?: string;
}

const SystemSecretDefinitions: ReadonlyArray<SystemSecretDefinition> = Object.freeze([
  Object.freeze({
    secretId: "secret:server:provider:openai",
    name: "provider.openai.api-key",
    kind: SecretKinds.apiKey,
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:provider:openai",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.manual,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.providerCredential],
      defaultPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
      }),
    }),
    metadata: Object.freeze({
      tags: Object.freeze(["server", "provider", "openai"]),
      labels: Object.freeze({
        provider: "openai",
        usage: "model-inference",
      }),
    }),
    runtimePurpose: "server-provider-openai-runtime",
    runtimeConsumer: "provider-credential",
    providerId: ServerPlatformProviderIds.openAi,
    legacyEnvironmentVariable: SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.openAiApiKey,
  }),
  Object.freeze({
    secretId: "secret:server:provider:huggingface",
    name: "provider.huggingface.api-token",
    kind: SecretKinds.accessToken,
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:provider:huggingface",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.manual,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.providerCredential],
      defaultPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
      }),
    }),
    metadata: Object.freeze({
      tags: Object.freeze(["server", "provider", "huggingface"]),
      labels: Object.freeze({
        provider: "huggingface",
        usage: "model-repository",
      }),
    }),
    runtimePurpose: "server-provider-huggingface-runtime",
    runtimeConsumer: "provider-credential",
    providerId: ServerPlatformProviderIds.huggingFace,
    legacyEnvironmentVariable: SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.huggingFaceApiToken,
  }),
  Object.freeze({
    secretId: "secret:server:signing:identity-session",
    name: "signing.identity.session.private-key",
    kind: SecretKinds.privateKey,
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:identity-session-signing",
      category: SecurityMaterialCategories.signingMaterial,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.serverSigning],
      defaultPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
      }),
      developmentPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
    }),
    metadata: Object.freeze({
      tags: Object.freeze(["server", "signing", "identity-session"]),
      labels: Object.freeze({
        algorithm: "ed25519",
        usage: "token-signing",
      }),
    }),
    runtimePurpose: "identity-session-token-signing",
    runtimeConsumer: "server-signing",
    legacyEnvironmentVariable: SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.identitySessionSigningPrivateKey,
  }),
]);

const SystemSecretDefinitionsById = new Map(
  SystemSecretDefinitions.map((definition) => [definition.secretId, definition] as const),
);

export const SystemSecretBootstrapStates = Object.freeze({
  ready: "ready",
  invalid: "invalid",
});

export type SystemSecretBootstrapState =
  typeof SystemSecretBootstrapStates[keyof typeof SystemSecretBootstrapStates];

export const SystemSecretBootstrapDiagnosticCodes = Object.freeze({
  unsupportedRequiredSecret: "unsupported-required-secret",
  requiredSecretMissing: "required-secret-missing",
  optionalSecretMissing: "optional-secret-missing",
  legacyMigrationUnavailable: "legacy-migration-unavailable",
  legacyMigrationFailed: "legacy-migration-failed",
  requiredSecretUnusable: "required-secret-unusable",
  optionalSecretUnusable: "optional-secret-unusable",
});

export type SystemSecretBootstrapDiagnosticCode =
  typeof SystemSecretBootstrapDiagnosticCodes[keyof typeof SystemSecretBootstrapDiagnosticCodes];

export interface SystemSecretBootstrapDiagnostic {
  readonly code: SystemSecretBootstrapDiagnosticCode;
  readonly secretId: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly startupRequirement: SecurityMaterialStartupRequirement;
  readonly durabilityClass: SecurityMaterialDurabilityClass;
  readonly fallbackPolicy: SecurityMaterialFallbackPolicy;
  readonly legacyEnvironmentVariable?: string;
}

export interface SystemSecretBootstrapResult {
  readonly state: SystemSecretBootstrapState;
  readonly requiredSecretIds: ReadonlyArray<string>;
  readonly migratedSecretIds: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<SystemSecretBootstrapDiagnostic>;
}

export interface BootstrapSystemSecretsFromEnvironmentInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
  readonly runtimeMaterialResolver?: IRuntimeSecurityMaterialResolverPort;
  readonly now?: () => Date;
}

interface SystemSecretBootstrapPersistencePort {
  readonly encryptionConfigured: boolean;
  getSecretMetadata(input: {
    readonly actor: ReturnType<typeof createAdministrativeActor>;
    readonly secretId: string;
    readonly occurredAt: string;
  }): ReturnType<ServerComposedSecretService["getSecretMetadataUseCase"]["execute"]>;
  createSecret(input: Parameters<ServerComposedSecretService["createSecretUseCase"]["execute"]>[0]):
    ReturnType<ServerComposedSecretService["createSecretUseCase"]["execute"]>;
}

export class SystemSecretBootstrapValidationError extends Error {
  public constructor(
    message: string,
    public readonly diagnostics: ReadonlyArray<SystemSecretBootstrapDiagnostic>,
  ) {
    super(message);
    this.name = "SystemSecretBootstrapValidationError";
  }
}

export async function bootstrapSystemSecretsFromEnvironment(
  input: BootstrapSystemSecretsFromEnvironmentInput,
): Promise<SystemSecretBootstrapResult> {
  const now = input.now ?? (() => new Date());
  const lifecycleStage = resolveLifecycleStage(input.env);
  const requiredSecretIds = parseOptionalCsvList(input.env[SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.requiredSecretIds]);
  if (requiredSecretIds.length === 0) {
    return Object.freeze({
      state: SystemSecretBootstrapStates.ready,
      requiredSecretIds,
      migratedSecretIds: Object.freeze([]),
      diagnostics: Object.freeze([]),
    });
  }

  const diagnostics: SystemSecretBootstrapDiagnostic[] = [];
  const migratedSecretIds: string[] = [];
  const migrationEnabled = parseOptionalBoolean(
    input.env[SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.migrateLegacyEnvironmentValues],
  ) ?? true;
  const administrativeActor = createAdministrativeActor();
  const runtimeMaterialResolver = input.runtimeMaterialResolver
    ?? new ServerPlatformSecretConsumers(input.secretService.runtimeSecretConsumptionAdapters);
  const bootstrapPersistence = createSystemSecretBootstrapPersistencePort(input.secretService);

  for (const secretId of requiredSecretIds) {
    const definition = SystemSecretDefinitionsById.get(secretId);
    if (!definition) {
      diagnostics.push(Object.freeze({
        code: SystemSecretBootstrapDiagnosticCodes.unsupportedRequiredSecret,
        secretId,
        message: `Required system secret '${secretId}' is not registered for bootstrap.`,
        severity: "error",
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }));
      continue;
    }

    const policy = resolveSecurityMaterialEnvironmentPolicy({
      classification: definition.classification,
      lifecycleStage,
    });
    const failFastRequired = isFailFastRequiredSecurityMaterial({
      classification: definition.classification,
      lifecycleStage,
    });

    const existingMetadata = await bootstrapPersistence.getSecretMetadata({
      actor: administrativeActor,
      secretId: definition.secretId,
      occurredAt: now().toISOString(),
    });

    if (!existingMetadata.ok) {
      const legacyEnvironmentVariable = definition.legacyEnvironmentVariable;
      const legacyValue = legacyEnvironmentVariable
        ? normalizeOptional(input.env[legacyEnvironmentVariable])
        : undefined;
      const canAttemptMigration = migrationEnabled && Boolean(legacyEnvironmentVariable && legacyValue);

      if (canAttemptMigration) {
        if (!bootstrapPersistence.encryptionConfigured) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.legacyMigrationUnavailable,
            secretId: definition.secretId,
            legacyEnvironmentVariable,
            message: "Legacy secret migration requires secret encryption configuration.",
            severity: "error",
            startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
            durabilityClass: SecurityMaterialDurabilityClasses.durable,
            fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
          }));
          continue;
        }

        const createResult = await bootstrapPersistence.createSecret({
          actor: administrativeActor,
          operationKey: `op:system-secret-bootstrap:create:${definition.secretId}:${now().getTime()}`,
          secretId: definition.secretId,
          name: definition.name,
          owner: Object.freeze({
            scope: SecretScopes.server,
          }),
          kind: definition.kind,
          plaintext: legacyValue as string,
          metadata: definition.metadata,
          createdAt: now().toISOString(),
        });

        if (!createResult.ok) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.legacyMigrationFailed,
            secretId: definition.secretId,
            legacyEnvironmentVariable,
            message: `Legacy secret migration failed (${createResult.error.code}).`,
            severity: "error",
            startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
            durabilityClass: SecurityMaterialDurabilityClasses.durable,
            fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
          }));
          continue;
        }

        migratedSecretIds.push(definition.secretId);
      } else {
        diagnostics.push(Object.freeze({
          code: failFastRequired
            ? SystemSecretBootstrapDiagnosticCodes.requiredSecretMissing
            : SystemSecretBootstrapDiagnosticCodes.optionalSecretMissing,
          secretId: definition.secretId,
          legacyEnvironmentVariable,
          message: failFastRequired
            ? "Required system secret is missing."
            : "Optional startup secret is missing in the current lifecycle stage.",
          severity: failFastRequired ? "error" : "warning",
          startupRequirement: policy.startupRequirement,
          durabilityClass: policy.durabilityClass,
          fallbackPolicy: policy.fallbackPolicy,
        }));
        continue;
      }
    }

    const runtimeCheck = definition.runtimeConsumer === "provider-credential"
      ? await runtimeMaterialResolver.resolveServerProviderCredential({
        providerId: definition.providerId as "openai" | "huggingface",
        secretId: definition.secretId,
        operationKey: `op:system-secret-bootstrap:validate:${definition.secretId}:${now().getTime()}`,
        serviceIdentity: "runtime:server:system-secret-bootstrap",
        justification: `validate required system secret for '${definition.runtimePurpose}'`,
        occurredAt: now().toISOString(),
      })
      : await runtimeMaterialResolver.resolveIdentitySessionSigningMaterial({
        secretId: definition.secretId,
        operationKey: `op:system-secret-bootstrap:validate:${definition.secretId}:${now().getTime()}`,
        serviceIdentity: "runtime:server:system-secret-bootstrap",
        signingPurpose: definition.runtimePurpose,
        justification: `validate required system secret for '${definition.runtimePurpose}'`,
        occurredAt: now().toISOString(),
      });

    if (!runtimeCheck.ok) {
      diagnostics.push(Object.freeze({
        code: failFastRequired
          ? SystemSecretBootstrapDiagnosticCodes.requiredSecretUnusable
          : SystemSecretBootstrapDiagnosticCodes.optionalSecretUnusable,
        secretId: definition.secretId,
        message: failFastRequired
          ? `Required system secret could not be resolved for runtime use (${runtimeCheck.error.code}).`
          : `Optional startup secret could not be resolved for runtime use (${runtimeCheck.error.code}).`,
        severity: failFastRequired ? "error" : "warning",
        startupRequirement: policy.startupRequirement,
        durabilityClass: policy.durabilityClass,
        fallbackPolicy: policy.fallbackPolicy,
      }));
    }
  }

  const state = diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? SystemSecretBootstrapStates.invalid
    : SystemSecretBootstrapStates.ready;

  return Object.freeze({
    state,
    requiredSecretIds,
    migratedSecretIds: Object.freeze([...new Set(migratedSecretIds)]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export async function assertSystemSecretBootstrapSafe(
  input: BootstrapSystemSecretsFromEnvironmentInput,
): Promise<SystemSecretBootstrapResult> {
  const result = await bootstrapSystemSecretsFromEnvironment(input);
  if (result.state === SystemSecretBootstrapStates.invalid) {
    throw new SystemSecretBootstrapValidationError(
      "System secret bootstrap validation failed.",
      result.diagnostics,
    );
  }
  return result;
}

function createSystemSecretBootstrapPersistencePort(
  secretService: ServerComposedSecretService,
): SystemSecretBootstrapPersistencePort {
  return Object.freeze({
    encryptionConfigured: secretService.status.configured,
    getSecretMetadata: (input) => secretService.getSecretMetadataUseCase.execute({
      actor: input.actor,
      secretId: input.secretId,
      occurredAt: input.occurredAt,
    }),
    createSecret: (input) => secretService.createSecretUseCase.execute(input),
  });
}

function createAdministrativeActor() {
  return Object.freeze({
    actorId: "system:secret-bootstrap",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: Object.freeze([
      SecretAccessActions.create,
      SecretAccessActions.readMetadata,
    ]),
  });
}

function parseOptionalCsvList(value: string | undefined): ReadonlyArray<string> {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return Object.freeze([]);
  }
  const entries = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Object.freeze([...new Set(entries)]);
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function resolveLifecycleStage(
  env: Readonly<Record<string, string | undefined>>,
): SecurityMaterialLifecycleStage {
  const nodeEnv = normalizeOptional(env.NODE_ENV)?.toLowerCase();
  if (nodeEnv === "development") {
    return SecurityMaterialLifecycleStages.development;
  }
  if (nodeEnv === "test") {
    return SecurityMaterialLifecycleStages.test;
  }
  return SecurityMaterialLifecycleStages.production;
}
