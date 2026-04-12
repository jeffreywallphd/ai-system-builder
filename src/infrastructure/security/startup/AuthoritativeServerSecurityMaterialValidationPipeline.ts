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
  type SecurityMaterialLifecycleStage,
} from "@application/security/contracts/SecurityMaterialClassificationContract";
import {
  SecurityMaterialPersistenceKinds,
  SecurityMaterialSourceKinds,
  runSecurityMaterialStartupValidationPipeline,
  type SecurityMaterialStartupValidationDescriptor,
  type SecurityMaterialStartupValidationObservation,
  type SecurityMaterialStartupValidationResult,
} from "@application/security/services/SecurityMaterialStartupValidationPipeline";
import type { HostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";

interface AuthoritativeServerSecurityMaterialValidationInput {
  readonly deploymentProfile: HostDeploymentProfile;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

const managedTlsEnabledEnvKey = "AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED";

const serverStartupSecurityMaterialDescriptors: ReadonlyArray<SecurityMaterialStartupValidationDescriptor> = Object.freeze([
  createDescriptor({
    materialId: "material:server:asset-download-grant-secret",
    environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
    inheritedEnvironmentKey: undefined,
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:asset-download-grant-secret",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.runtimeRequest],
      hierarchy: createServerRuntimeSecretHierarchy(),
      defaultPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
      developmentPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
    }),
  }),
  createDescriptor({
    materialId: "material:server:asset-content-encryption-key",
    environmentKey: "AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:asset-content-encryption-key",
      category: SecurityMaterialCategories.encryptionKey,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.runtimeRequest],
      hierarchy: createStorageContentKeyHierarchy(),
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
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
    }),
  }),
  createDescriptor({
    materialId: "material:server:image-asset-storage-token-secret",
    environmentKey: "AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:image-asset-storage-token-secret",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.runtimeRequest],
      hierarchy: createServerRuntimeSecretHierarchy(),
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
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
    }),
  }),
  createDescriptor({
    materialId: "material:server:image-upload-session-token-secret",
    environmentKey: "AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:image-upload-session-token-secret",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.runtimeRequest],
      hierarchy: createServerRuntimeSecretHierarchy(),
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
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
    }),
  }),
  createDescriptor({
    materialId: "material:server:generated-result-preview-access-token-secret",
    environmentKey: "AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET",
    inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:generated-result-preview-access-token-secret",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.runtimeRequest],
      hierarchy: createServerRuntimeSecretHierarchy(),
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
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      }),
    }),
  }),
  createRequiredListDescriptor(),
  createManagedTlsPrivateKeyDescriptor(),
]);

export function validateAuthoritativeServerStartupSecurityMaterial(
  input: AuthoritativeServerSecurityMaterialValidationInput,
): SecurityMaterialStartupValidationResult {
  const lifecycleStage = resolveLifecycleStage(input.deploymentProfile, input.environment);
  return runSecurityMaterialStartupValidationPipeline({
    context: Object.freeze({
      lifecycleStage,
      deploymentProfile: Object.freeze({
        profileId: input.deploymentProfile.profileId,
        environmentName: input.deploymentProfile.environmentName,
        releaseChannel: input.deploymentProfile.releaseChannel,
      }),
      environment: input.environment,
    }),
    descriptors: serverStartupSecurityMaterialDescriptors,
  });
}

function createDescriptor(input: {
  readonly materialId: string;
  readonly environmentKey: string;
  readonly inheritedEnvironmentKey?: string;
  readonly classification: SecurityMaterialStartupValidationDescriptor["classification"];
}): SecurityMaterialStartupValidationDescriptor {
  return Object.freeze({
    materialId: input.materialId,
    classification: input.classification,
    resolveObservation: (context) => resolveEnvironmentMaterialObservation({
      environment: context.environment,
      materialId: input.materialId,
      environmentKey: input.environmentKey,
      inheritedEnvironmentKey: input.inheritedEnvironmentKey,
    }),
  });
}

function createRequiredListDescriptor(): SecurityMaterialStartupValidationDescriptor {
  return Object.freeze({
    materialId: "material:server:system-secret-bootstrap-required-list",
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:system-secret-bootstrap-required-list",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.notApplicable,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap],
      hierarchy: createServerRuntimeSecretHierarchy(),
      defaultPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
      developmentPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
    }),
    resolveObservation: (context) => {
      const secretIdsRaw = normalizeOptional(
        context.environment.AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS,
      );
      const ids = secretIdsRaw
        ? secretIdsRaw.split(",").map((entry) => entry.trim()).filter(Boolean)
        : [];

      return Object.freeze({
        materialId: "material:server:system-secret-bootstrap-required-list",
        sourceKind: secretIdsRaw
          ? SecurityMaterialSourceKinds.environment
          : SecurityMaterialSourceKinds.missing,
        present: ids.length > 0,
        formatValid: !secretIdsRaw || ids.length > 0,
        persistence: SecurityMaterialPersistenceKinds.durable,
        details: Object.freeze({
          environmentKey: "AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS",
          secretCount: String(ids.length),
        }),
      });
    },
  });
}

function createManagedTlsPrivateKeyDescriptor(): SecurityMaterialStartupValidationDescriptor {
  return Object.freeze({
    materialId: "material:server:managed-tls-private-key-material-ref",
    classification: createSecurityMaterialClassificationContract({
      materialId: "material:server:managed-tls-private-key-material-ref",
      category: SecurityMaterialCategories.certificateMaterial,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.transportSecurity],
      hierarchy: createCertificateAuthorityHierarchy(),
      defaultPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
      developmentPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
      testPolicy: Object.freeze({
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      }),
    }),
    resolveObservation: (context) => {
      const tlsEnabled = parseOptionalBoolean(context.environment[managedTlsEnabledEnvKey]) ?? false;
      if (!tlsEnabled) {
        return Object.freeze({
          materialId: "material:server:managed-tls-private-key-material-ref",
          sourceKind: SecurityMaterialSourceKinds.notApplicable,
          present: true,
          formatValid: true,
          persistence: SecurityMaterialPersistenceKinds.durable,
          details: Object.freeze({
            tlsEnabled: "false",
            environmentKey: managedTlsEnabledEnvKey,
          }),
        });
      }

      const keyRef = normalizeOptional(context.environment.AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF);
      const targetReferenceId = normalizeOptional(context.environment.AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID)
        ?? "server:authoritative";
      return Object.freeze({
        materialId: "material:server:managed-tls-private-key-material-ref",
        sourceKind: keyRef
          ? SecurityMaterialSourceKinds.environment
          : SecurityMaterialSourceKinds.missing,
        present: Boolean(keyRef),
        formatValid: targetReferenceId.startsWith("server:"),
        persistence: SecurityMaterialPersistenceKinds.durable,
        details: Object.freeze({
          tlsEnabled: "true",
          targetReferenceId,
          privateKeyRefConfigured: keyRef ? "true" : "false",
          privateKeyEnvironmentKey: "AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF",
          targetReferenceEnvironmentKey: "AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID",
        }),
      });
    },
  });
}

function resolveEnvironmentMaterialObservation(input: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly materialId: string;
  readonly environmentKey: string;
  readonly inheritedEnvironmentKey?: string;
}): SecurityMaterialStartupValidationObservation {
  const configured = normalizeOptional(input.environment[input.environmentKey]);
  if (configured) {
    return Object.freeze({
      materialId: input.materialId,
      sourceKind: SecurityMaterialSourceKinds.environment,
      present: true,
      formatValid: configured.length >= 16,
      persistence: SecurityMaterialPersistenceKinds.durable,
      details: Object.freeze({
        environmentKey: input.environmentKey,
      }),
    });
  }

  if (input.inheritedEnvironmentKey) {
    const inherited = normalizeOptional(input.environment[input.inheritedEnvironmentKey]);
    if (inherited) {
      return Object.freeze({
        materialId: input.materialId,
        sourceKind: SecurityMaterialSourceKinds.inheritedEnvironment,
        present: true,
        formatValid: inherited.length >= 16,
        persistence: SecurityMaterialPersistenceKinds.durable,
        details: Object.freeze({
          inheritedEnvironmentKey: input.inheritedEnvironmentKey,
          environmentKey: input.environmentKey,
        }),
      });
    }
  }

  return Object.freeze({
    materialId: input.materialId,
    sourceKind: SecurityMaterialSourceKinds.generatedEphemeral,
    present: true,
    formatValid: true,
    persistence: SecurityMaterialPersistenceKinds.ephemeral,
    details: Object.freeze({
      environmentKey: input.environmentKey,
      inheritedEnvironmentKey: input.inheritedEnvironmentKey ?? "",
    }),
  });
}

function createServerRuntimeSecretHierarchy() {
  return Object.freeze({
    hierarchyClass: SecurityMaterialHierarchyClasses.serverRuntimeSecretMaterial,
    ownership: Object.freeze({
      ownerScope: SecurityMaterialScopes.server,
      ownerSubsystem: SecurityMaterialOwningSubsystems.serverControlPlane,
      storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
      consumerSubsystems: Object.freeze([
        SecurityMaterialConsumerSubsystems.serverBootstrap,
        SecurityMaterialConsumerSubsystems.assetStorage,
      ]),
    }),
    lifecycle: Object.freeze({
      creationMode: SecurityMaterialCreationModes.generatedAtBootstrap,
      rotationMode: SecurityMaterialRotationModes.onCompromise,
      revocationMode: SecurityMaterialRevocationModes.optional,
      requiresReEncryptionOnRotation: false,
    }),
  });
}

function createStorageContentKeyHierarchy() {
  return Object.freeze({
    hierarchyClass: SecurityMaterialHierarchyClasses.storageContentKey,
    ownership: Object.freeze({
      ownerScope: SecurityMaterialScopes.server,
      ownerSubsystem: SecurityMaterialOwningSubsystems.assetProtectionService,
      storageSubsystem: SecurityMaterialStorageSubsystems.assetKeyStore,
      consumerSubsystems: Object.freeze([
        SecurityMaterialConsumerSubsystems.serverBootstrap,
        SecurityMaterialConsumerSubsystems.assetStorage,
      ]),
    }),
    lifecycle: Object.freeze({
      creationMode: SecurityMaterialCreationModes.migratedFromLegacyInput,
      rotationMode: SecurityMaterialRotationModes.onCompromise,
      revocationMode: SecurityMaterialRevocationModes.required,
      requiresReEncryptionOnRotation: true,
    }),
  });
}

function createCertificateAuthorityHierarchy() {
  return Object.freeze({
    hierarchyClass: SecurityMaterialHierarchyClasses.certificateAuthorityKey,
    ownership: Object.freeze({
      ownerScope: SecurityMaterialScopes.server,
      ownerSubsystem: SecurityMaterialOwningSubsystems.certificateAuthorityService,
      storageSubsystem: SecurityMaterialStorageSubsystems.certificateAuthorityStore,
      consumerSubsystems: Object.freeze([
        SecurityMaterialConsumerSubsystems.serverBootstrap,
        SecurityMaterialConsumerSubsystems.transportSecurity,
      ]),
    }),
    lifecycle: Object.freeze({
      creationMode: SecurityMaterialCreationModes.externallyProvisioned,
      rotationMode: SecurityMaterialRotationModes.scheduled,
      revocationMode: SecurityMaterialRevocationModes.required,
      requiresReEncryptionOnRotation: false,
    }),
  });
}

function resolveLifecycleStage(
  deploymentProfile: HostDeploymentProfile,
  environment: Readonly<Record<string, string | undefined>>,
): SecurityMaterialLifecycleStage {
  const environmentName = deploymentProfile.environmentName.trim().toLowerCase();
  const releaseChannel = deploymentProfile.releaseChannel.trim().toLowerCase();
  const nodeEnv = normalizeOptional(environment.NODE_ENV)?.toLowerCase();

  if (nodeEnv === "test" || releaseChannel === "ci") {
    return SecurityMaterialLifecycleStages.test;
  }
  if (nodeEnv === "development" || environmentName === "development" || releaseChannel === "development") {
    return SecurityMaterialLifecycleStages.development;
  }
  return SecurityMaterialLifecycleStages.production;
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
