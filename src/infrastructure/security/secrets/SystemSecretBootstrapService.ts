import {
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  type SecretKind,
} from "@domain/security/SecretDomain";
import {
  SecurityMaterialConsumerSubsystems,
  SecurityMaterialCreationModes,
  SecurityMaterialHierarchyClasses,
  SecurityMaterialOwningSubsystems,
  SecurityMaterialRevocationModes,
  SecurityMaterialRotationModes,
  SecurityMaterialStorageSubsystems,
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
import { ServerPlatformProviderIds } from "./ServerPlatformSecretConsumers";
import {
  SecretProviderMaterialKinds,
  type ISecretProviderMaterialResolutionPort,
  type SecretProviderMaterialMetadata,
  type SecretProviderMaterialSelector,
} from "@application/security/ports/SecretProviderPorts";
import type { SecretAccessAuditEvent } from "@application/security/ports/SecretServicePorts";
import { ScopedSecretProviderMaterialRetrievalUseCase } from "@application/security/use-cases/ScopedSecretProviderMaterialRetrievalUseCase";
import { DefaultSecretProviderResolutionService } from "@infrastructure/security/DefaultSecretProviderResolutionService";

const SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS = Object.freeze({
  requiredSecretIds: "AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS",
  migrateLegacyEnvironmentValues: "AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV",
  openAiApiKey: "OPENAI_API_KEY",
  huggingFaceApiToken: "HUGGINGFACE_API_TOKEN",
  identitySessionSigningPrivateKey: "AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY",
});

const SystemSecretBootstrapCreationPolicies = Object.freeze({
  migrateLegacyOnly: "migrate-legacy-only",
  migrateLegacyOrGenerate: "migrate-legacy-or-generate",
});

type SystemSecretBootstrapCreationPolicy =
  typeof SystemSecretBootstrapCreationPolicies[keyof typeof SystemSecretBootstrapCreationPolicies];

const SystemSecretBootstrapGenerationStrategies = Object.freeze({
  ed25519PrivateKeyPkcs8Pem: "ed25519-private-key-pkcs8-pem",
  random32ByteBase64: "random-32-byte-base64",
  random48ByteBase64Url: "random-48-byte-base64url",
});

type SystemSecretBootstrapGenerationStrategy =
  typeof SystemSecretBootstrapGenerationStrategies[keyof typeof SystemSecretBootstrapGenerationStrategies];

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
  readonly bootstrapCreationPolicy: SystemSecretBootstrapCreationPolicy;
  readonly bootstrapGenerationStrategy?: SystemSecretBootstrapGenerationStrategy;
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
      hierarchy: createServerProviderCredentialHierarchy(),
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
    bootstrapCreationPolicy: SystemSecretBootstrapCreationPolicies.migrateLegacyOnly,
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
      hierarchy: createServerProviderCredentialHierarchy(),
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
    bootstrapCreationPolicy: SystemSecretBootstrapCreationPolicies.migrateLegacyOnly,
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
      hierarchy: createServerTokenSigningHierarchy(),
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
    bootstrapCreationPolicy: SystemSecretBootstrapCreationPolicies.migrateLegacyOrGenerate,
    bootstrapGenerationStrategy: SystemSecretBootstrapGenerationStrategies.ed25519PrivateKeyPkcs8Pem,
  }),
]);

const SystemSecretDefinitionsById = new Map(
  SystemSecretDefinitions.map((definition) => [definition.secretId, definition] as const),
);

export interface SystemSecretGovernanceDescriptor {
  readonly secretId: string;
  readonly providerId: string;
  readonly materialKind: "provider-credential" | "signing-material";
  readonly classification: {
    readonly materialId: string;
    readonly category: SecurityMaterialClassificationContract["category"];
    readonly scope: SecurityMaterialClassificationContract["scope"];
    readonly rotationPosture: SecurityMaterialClassificationContract["rotationPosture"];
    readonly usageContexts: ReadonlyArray<SecurityMaterialClassificationContract["usageContexts"][number]>;
  };
  readonly policies: {
    readonly defaultPolicy: SecurityMaterialClassificationContract["defaultPolicy"];
    readonly developmentPolicy?: SecurityMaterialClassificationContract["developmentPolicy"];
    readonly testPolicy?: SecurityMaterialClassificationContract["testPolicy"];
  };
  readonly bootstrap: {
    readonly creationPolicy: SystemSecretBootstrapCreationPolicy;
    readonly generationStrategy?: SystemSecretBootstrapGenerationStrategy;
  };
}

function createServerProviderCredentialHierarchy() {
  return Object.freeze({
    hierarchyClass: SecurityMaterialHierarchyClasses.providerCredentialMaterial,
    ownership: Object.freeze({
      ownerScope: SecurityMaterialScopes.server,
      ownerSubsystem: SecurityMaterialOwningSubsystems.providerIntegrationService,
      storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
      consumerSubsystems: Object.freeze([
        SecurityMaterialConsumerSubsystems.serverBootstrap,
        SecurityMaterialConsumerSubsystems.providerRuntime,
      ]),
    }),
    lifecycle: Object.freeze({
      creationMode: SecurityMaterialCreationModes.migratedFromLegacyInput,
      rotationMode: SecurityMaterialRotationModes.manual,
      revocationMode: SecurityMaterialRevocationModes.optional,
      requiresReEncryptionOnRotation: false,
    }),
  });
}

function createServerTokenSigningHierarchy() {
  return Object.freeze({
    hierarchyClass: SecurityMaterialHierarchyClasses.tokenSigningKey,
    ownership: Object.freeze({
      ownerScope: SecurityMaterialScopes.server,
      ownerSubsystem: SecurityMaterialOwningSubsystems.identitySessionService,
      storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
      consumerSubsystems: Object.freeze([
        SecurityMaterialConsumerSubsystems.serverBootstrap,
        SecurityMaterialConsumerSubsystems.identityTokenIssuance,
      ]),
    }),
    lifecycle: Object.freeze({
      creationMode: SecurityMaterialCreationModes.generatedAtBootstrap,
      rotationMode: SecurityMaterialRotationModes.onCompromise,
      revocationMode: SecurityMaterialRevocationModes.required,
      requiresReEncryptionOnRotation: false,
    }),
  });
}

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
  bootstrapCreationUnavailable: "bootstrap-creation-unavailable",
  bootstrapCreationFailed: "bootstrap-creation-failed",
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
  readonly materialMetadata: ReadonlyArray<SecretProviderMaterialMetadata>;
  readonly diagnostics: ReadonlyArray<SystemSecretBootstrapDiagnostic>;
}

export interface BootstrapSystemSecretsFromEnvironmentInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
  readonly secretProviderResolutionPort?: ISecretProviderMaterialResolutionPort;
  readonly auditHook?: (event: SecretAccessAuditEvent) => Promise<void> | void;
  readonly now?: () => Date;
}

export function listSystemSecretGovernanceDescriptors(): ReadonlyArray<SystemSecretGovernanceDescriptor> {
  return Object.freeze(SystemSecretDefinitions.map((definition) => (
    toSystemSecretGovernanceDescriptor(definition)
  )));
}

export function resolveSystemSecretGovernanceDescriptor(
  secretId: string,
): SystemSecretGovernanceDescriptor | undefined {
  const normalizedSecretId = normalizeOptional(secretId);
  if (!normalizedSecretId) {
    return undefined;
  }
  const definition = SystemSecretDefinitionsById.get(normalizedSecretId);
  if (!definition) {
    return undefined;
  }
  return toSystemSecretGovernanceDescriptor(definition);
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
  const lifecycleStage = resolveSystemSecretBootstrapLifecycleStage(input.env);
  const requiredSecretIds = parseOptionalCsvList(input.env[SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.requiredSecretIds]);
  if (requiredSecretIds.length === 0) {
    return Object.freeze({
      state: SystemSecretBootstrapStates.ready,
      requiredSecretIds,
      migratedSecretIds: Object.freeze([]),
      materialMetadata: Object.freeze([]),
      diagnostics: Object.freeze([]),
    });
  }

  const diagnostics: SystemSecretBootstrapDiagnostic[] = [];
  const migratedSecretIds: string[] = [];
  const materialMetadata: SecretProviderMaterialMetadata[] = [];
  const migrationEnabled = parseOptionalBoolean(
    input.env[SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.migrateLegacyEnvironmentValues],
  ) ?? true;
  const secretProviderResolutionPort = input.secretProviderResolutionPort
    ?? new DefaultSecretProviderResolutionService({
      runtimeSecretConsumptionAdapters: input.secretService.runtimeSecretConsumptionAdapters,
      getSecretMetadata: (request) => input.secretService.getSecretMetadataUseCase.execute(request),
      createSecret: (request) => input.secretService.createSecretUseCase.execute(request),
      initializeServerSecretStore: async () => {
        const repositoryCheck = await input.secretService.listSecretsUseCase.execute({
          actor: Object.freeze({
            actorId: "system:secret-provider-backend:init",
            actorType: SecretActorTypes.serverAdmin,
            grantedActions: Object.freeze([SecretAccessActions.list]),
          }),
          owner: Object.freeze({
            scope: SecretScopes.server,
          }),
          limit: 1,
          offset: 0,
          includeDisabled: true,
          includeArchived: true,
          includeSoftDeleted: true,
        });
        if (!repositoryCheck.ok) {
          throw new Error(`server-secret-repository-init-failed:${repositoryCheck.error.code}`);
        }
      },
    });
  const scopedSecretProviderRetrievalUseCase = new ScopedSecretProviderMaterialRetrievalUseCase({
    secretProviderResolutionPort,
    secretAccessPolicyPort: input.secretService.secretAccessPolicyPort,
    secretAccessAuditPort: new CallbackSecretAccessAuditPort(input.auditHook),
    now,
  });

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
    const selector = createSystemSecretMaterialSelector(definition);

    const metadataExists = await scopedSecretProviderRetrievalUseCase.serverScopedSecretProviderMaterialExists({
      caller: createBootstrapScopeCheckActor(),
      providerId: selector.providerId,
      secretId: selector.secretId,
      materialKind: selector.materialKind,
      access: {
        operationKey: `op:system-secret-bootstrap:metadata:${definition.secretId}:${now().getTime()}`,
        serviceIdentity: "runtime:server:system-secret-bootstrap",
        usage: "system-secret-bootstrap-metadata-check",
        occurredAt: now().toISOString(),
      },
    });
    if (!metadataExists.ok) {
      diagnostics.push(Object.freeze({
        code: failFastRequired
          ? SystemSecretBootstrapDiagnosticCodes.requiredSecretUnusable
          : SystemSecretBootstrapDiagnosticCodes.optionalSecretUnusable,
        secretId: definition.secretId,
        message: failFastRequired
          ? `Required system secret metadata could not be resolved (${metadataExists.error.code}).`
          : `Optional startup secret metadata could not be resolved (${metadataExists.error.code}).`,
        severity: failFastRequired ? "error" : "warning",
        startupRequirement: policy.startupRequirement,
        durabilityClass: policy.durabilityClass,
        fallbackPolicy: policy.fallbackPolicy,
      }));
      continue;
    }

    let shouldResolveMetadata = metadataExists.value.exists;

    if (!metadataExists.value.exists) {
      const legacyEnvironmentVariable = definition.legacyEnvironmentVariable;
      const legacyValue = legacyEnvironmentVariable
        ? normalizeOptional(input.env[legacyEnvironmentVariable])
        : undefined;
      const canAttemptMigration = migrationEnabled && Boolean(legacyEnvironmentVariable && legacyValue);

      if (canAttemptMigration) {
        if (!input.secretService.status.configured) {
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

        const bootstrapResult = await secretProviderResolutionPort.bootstrapSecretProviderMaterial({
          selector,
          access: {
            operationKey: `op:system-secret-bootstrap:create:${definition.secretId}:${now().getTime()}`,
            serviceIdentity: "runtime:server:system-secret-bootstrap",
            usage: "system-secret-bootstrap-create",
            occurredAt: now().toISOString(),
          },
          name: definition.name,
          kind: definition.kind,
          plaintext: legacyValue as string,
          metadata: enrichBootstrapMetadata({
            definition,
            source: "legacy-environment-migration",
          }),
        });

        if (!bootstrapResult.ok) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.legacyMigrationFailed,
            secretId: definition.secretId,
            legacyEnvironmentVariable,
            message: `Legacy secret migration failed (${bootstrapResult.error.code}).`,
            severity: "error",
            startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
            durabilityClass: SecurityMaterialDurabilityClasses.durable,
            fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
          }));
          continue;
        }

        migratedSecretIds.push(definition.secretId);
        shouldResolveMetadata = true;
      } else if (shouldAttemptBootstrapGeneration(definition)) {
        if (!input.secretService.status.configured) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.bootstrapCreationUnavailable,
            secretId: definition.secretId,
            message: "Bootstrap key creation requires secret encryption configuration.",
            severity: failFastRequired ? "error" : "warning",
            startupRequirement: policy.startupRequirement,
            durabilityClass: policy.durabilityClass,
            fallbackPolicy: policy.fallbackPolicy,
          }));
          continue;
        }

        const generatedPlaintextResult = createBootstrapGeneratedPlaintext(definition);
        if (!generatedPlaintextResult.ok) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.bootstrapCreationFailed,
            secretId: definition.secretId,
            message: generatedPlaintextResult.error,
            severity: failFastRequired ? "error" : "warning",
            startupRequirement: policy.startupRequirement,
            durabilityClass: policy.durabilityClass,
            fallbackPolicy: policy.fallbackPolicy,
          }));
          continue;
        }

        const bootstrapCreateResult = await secretProviderResolutionPort.bootstrapSecretProviderMaterial({
          selector,
          access: {
            operationKey: `op:system-secret-bootstrap:create:${definition.secretId}:${now().getTime()}`,
            serviceIdentity: "runtime:server:system-secret-bootstrap",
            usage: "system-secret-bootstrap-create",
            occurredAt: now().toISOString(),
          },
          name: definition.name,
          kind: definition.kind,
          plaintext: generatedPlaintextResult.value,
          metadata: enrichBootstrapMetadata({
            definition,
            source: "bootstrap-generated",
          }),
        });
        if (!bootstrapCreateResult.ok) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.bootstrapCreationFailed,
            secretId: definition.secretId,
            message: `Bootstrap key creation failed (${bootstrapCreateResult.error.code}).`,
            severity: failFastRequired ? "error" : "warning",
            startupRequirement: policy.startupRequirement,
            durabilityClass: policy.durabilityClass,
            fallbackPolicy: policy.fallbackPolicy,
          }));
          continue;
        }

        shouldResolveMetadata = true;
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

    if (shouldResolveMetadata) {
      const metadataResult = await scopedSecretProviderRetrievalUseCase.getServerScopedSecretProviderMaterialMetadata({
        caller: createBootstrapScopeCheckActor(),
        providerId: selector.providerId,
        secretId: selector.secretId,
        materialKind: selector.materialKind,
        access: {
          operationKey: `op:system-secret-bootstrap:metadata-details:${definition.secretId}:${now().getTime()}`,
          serviceIdentity: "runtime:server:system-secret-bootstrap",
          usage: "system-secret-bootstrap-metadata-details",
          occurredAt: now().toISOString(),
        },
      });
      if (!metadataResult.ok) {
        diagnostics.push(Object.freeze({
          code: failFastRequired
            ? SystemSecretBootstrapDiagnosticCodes.requiredSecretUnusable
            : SystemSecretBootstrapDiagnosticCodes.optionalSecretUnusable,
          secretId: definition.secretId,
          message: failFastRequired
            ? `Required system secret metadata details could not be resolved (${metadataResult.error.code}).`
            : `Optional startup secret metadata details could not be resolved (${metadataResult.error.code}).`,
          severity: failFastRequired ? "error" : "warning",
          startupRequirement: policy.startupRequirement,
          durabilityClass: policy.durabilityClass,
          fallbackPolicy: policy.fallbackPolicy,
        }));
        continue;
      }

      materialMetadata.push(metadataResult.value);
    }

    const runtimeCheck = await scopedSecretProviderRetrievalUseCase.retrieveServerScopedSecretProviderMaterial({
      caller: createBootstrapRuntimeRetrievalActor(),
      providerId: selector.providerId,
      secretId: selector.secretId,
      materialKind: selector.materialKind,
      access: {
        operationKey: `op:system-secret-bootstrap:validate:${definition.secretId}:${now().getTime()}`,
        serviceIdentity: "runtime:server:system-secret-bootstrap",
        usage: definition.runtimePurpose,
        justification: `validate required system secret for '${definition.runtimePurpose}'`,
        occurredAt: now().toISOString(),
      },
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
    materialMetadata: Object.freeze(deduplicateMaterialMetadataBySecretId(materialMetadata)),
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

function createBootstrapScopeCheckActor() {
  return Object.freeze({
    actorId: "runtime:server:system-secret-bootstrap",
    actorType: SecretActorTypes.serverRuntime,
    grantedActions: Object.freeze([SecretAccessActions.readMetadata]),
  });
}

function createBootstrapRuntimeRetrievalActor() {
  return Object.freeze({
    actorId: "runtime:server:system-secret-bootstrap",
    actorType: SecretActorTypes.serverRuntime,
    grantedActions: Object.freeze([SecretAccessActions.retrievePlaintext]),
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

export function resolveSystemSecretBootstrapLifecycleStage(
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

function toSystemSecretGovernanceDescriptor(
  definition: SystemSecretDefinition,
): SystemSecretGovernanceDescriptor {
  return Object.freeze({
    secretId: definition.secretId,
    providerId: definition.providerId ?? "platform",
    materialKind: definition.runtimeConsumer === "provider-credential"
      ? "provider-credential"
      : "signing-material",
    classification: Object.freeze({
      materialId: definition.classification.materialId,
      category: definition.classification.category,
      scope: definition.classification.scope,
      rotationPosture: definition.classification.rotationPosture,
      usageContexts: Object.freeze([...definition.classification.usageContexts]),
    }),
    policies: Object.freeze({
      defaultPolicy: Object.freeze({
        ...definition.classification.defaultPolicy,
      }),
      developmentPolicy: definition.classification.developmentPolicy
        ? Object.freeze({
          ...definition.classification.developmentPolicy,
        })
        : undefined,
      testPolicy: definition.classification.testPolicy
        ? Object.freeze({
          ...definition.classification.testPolicy,
        })
        : undefined,
    }),
    bootstrap: Object.freeze({
      creationPolicy: definition.bootstrapCreationPolicy,
      generationStrategy: definition.bootstrapGenerationStrategy,
    }),
  });
}

function createSystemSecretMaterialSelector(
  definition: SystemSecretDefinition,
): SecretProviderMaterialSelector {
  return Object.freeze({
    providerId: definition.providerId ?? "platform",
    secretId: definition.secretId,
    scope: Object.freeze({
      scope: SecretScopes.server,
    }),
    materialKind: definition.runtimeConsumer === "provider-credential"
      ? SecretProviderMaterialKinds.providerCredential
      : SecretProviderMaterialKinds.signingMaterial,
  });
}

function shouldAttemptBootstrapGeneration(definition: SystemSecretDefinition): boolean {
  return definition.bootstrapCreationPolicy === SystemSecretBootstrapCreationPolicies.migrateLegacyOrGenerate
    && typeof definition.bootstrapGenerationStrategy === "string";
}

function createBootstrapGeneratedPlaintext(
  definition: SystemSecretDefinition,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string } {
  const strategy = definition.bootstrapGenerationStrategy;
  if (!strategy) {
    return {
      ok: false,
      error: "Bootstrap key creation strategy is not configured.",
    };
  }

  if (strategy === SystemSecretBootstrapGenerationStrategies.ed25519PrivateKeyPkcs8Pem) {
    const keyPair = generateKeyPairSync("ed25519");
    return {
      ok: true,
      value: keyPair.privateKey.export({
        type: "pkcs8",
        format: "pem",
      }).toString(),
    };
  }

  if (strategy === SystemSecretBootstrapGenerationStrategies.random32ByteBase64) {
    return {
      ok: true,
      value: randomBytes(32).toString("base64"),
    };
  }

  if (strategy === SystemSecretBootstrapGenerationStrategies.random48ByteBase64Url) {
    return {
      ok: true,
      value: randomBytes(48).toString("base64url"),
    };
  }

  return {
    ok: false,
    error: `Bootstrap key creation strategy '${strategy}' is unsupported.`,
  };
}

function enrichBootstrapMetadata(input: {
  readonly definition: SystemSecretDefinition;
  readonly source: "legacy-environment-migration" | "bootstrap-generated";
}) {
  const tags = new Set(input.definition.metadata.tags);
  tags.add("bootstrap");
  tags.add(input.source === "bootstrap-generated" ? "bootstrap-generated" : "bootstrap-migrated");

  return Object.freeze({
    tags: Object.freeze([...tags.values()]),
    labels: Object.freeze({
      ...input.definition.metadata.labels,
      bootstrapSource: input.source,
      bootstrapPolicy: input.definition.bootstrapCreationPolicy,
      material: input.definition.classification.materialId,
    }),
  });
}

function deduplicateMaterialMetadataBySecretId(
  metadata: ReadonlyArray<SecretProviderMaterialMetadata>,
): ReadonlyArray<SecretProviderMaterialMetadata> {
  const bySecretId = new Map<string, SecretProviderMaterialMetadata>();
  for (const item of metadata) {
    bySecretId.set(item.secretId, item);
  }
  return Object.freeze([...bySecretId.values()]);
}

class CallbackSecretAccessAuditPort {
  public constructor(
    private readonly hook?: (event: SecretAccessAuditEvent) => Promise<void> | void,
  ) {}

  public async recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void> {
    if (!this.hook) {
      return;
    }
    await this.hook(event);
  }
}
