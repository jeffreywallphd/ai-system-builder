import { describe, expect, it } from "bun:test";
import {
  SecurityMaterialConsumerSubsystems,
  SecurityMaterialCreationModes,
  SecurityMaterialHierarchyClasses,
  SecurityMaterialOwningSubsystems,
  SecurityMaterialRevocationModes,
  SecurityMaterialRotationModes,
  SecurityMaterialStorageSubsystems,
} from "../contracts/SecurityMaterialKeyHierarchyContract";
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
} from "../contracts/SecurityMaterialClassificationContract";

describe("SecurityMaterialClassificationContract", () => {
  it("resolves fail-fast durable posture by default", () => {
    const contract = createSecurityMaterialClassificationContract({
      materialId: "material:server:provider:openai",
      category: SecurityMaterialCategories.secretCredential,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.manual,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.providerCredential],
      hierarchy: Object.freeze({
        hierarchyClass: SecurityMaterialHierarchyClasses.providerCredentialMaterial,
        ownership: Object.freeze({
          ownerScope: SecurityMaterialScopes.server,
          ownerSubsystem: SecurityMaterialOwningSubsystems.providerIntegrationService,
          storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
          consumerSubsystems: Object.freeze([SecurityMaterialConsumerSubsystems.providerRuntime]),
        }),
        lifecycle: Object.freeze({
          creationMode: SecurityMaterialCreationModes.externallyProvisioned,
          rotationMode: SecurityMaterialRotationModes.manual,
          revocationMode: SecurityMaterialRevocationModes.optional,
          requiresReEncryptionOnRotation: false,
        }),
      }),
      defaultPolicy: {
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
      },
    });

    const productionPolicy = resolveSecurityMaterialEnvironmentPolicy({
      classification: contract,
      lifecycleStage: SecurityMaterialLifecycleStages.production,
    });

    expect(productionPolicy).toEqual({
      durabilityClass: SecurityMaterialDurabilityClasses.durable,
      startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
      fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
    });
    expect(isFailFastRequiredSecurityMaterial({
      classification: contract,
      lifecycleStage: SecurityMaterialLifecycleStages.production,
    })).toBeTrue();
  });

  it("supports optional development-ephemeral overrides without changing production policy", () => {
    const contract = createSecurityMaterialClassificationContract({
      materialId: "material:server:identity-session-signing",
      category: SecurityMaterialCategories.signingMaterial,
      scope: SecurityMaterialScopes.server,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.startupBootstrap, SecurityMaterialUsageContexts.serverSigning],
      hierarchy: Object.freeze({
        hierarchyClass: SecurityMaterialHierarchyClasses.tokenSigningKey,
        ownership: Object.freeze({
          ownerScope: SecurityMaterialScopes.server,
          ownerSubsystem: SecurityMaterialOwningSubsystems.identitySessionService,
          storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
          consumerSubsystems: Object.freeze([SecurityMaterialConsumerSubsystems.identityTokenIssuance]),
        }),
        lifecycle: Object.freeze({
          creationMode: SecurityMaterialCreationModes.generatedAtBootstrap,
          rotationMode: SecurityMaterialRotationModes.onCompromise,
          revocationMode: SecurityMaterialRevocationModes.required,
          requiresReEncryptionOnRotation: false,
        }),
      }),
      defaultPolicy: {
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.migrateLegacyInput,
      },
      developmentPolicy: {
        durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
        startupRequirement: SecurityMaterialStartupRequirements.optional,
        fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
      },
    });

    const developmentPolicy = resolveSecurityMaterialEnvironmentPolicy({
      classification: contract,
      lifecycleStage: SecurityMaterialLifecycleStages.development,
    });

    expect(developmentPolicy).toEqual({
      durabilityClass: SecurityMaterialDurabilityClasses.ephemeral,
      startupRequirement: SecurityMaterialStartupRequirements.optional,
      fallbackPolicy: SecurityMaterialFallbackPolicies.generateEphemeralForDevelopment,
    });
    expect(isFailFastRequiredSecurityMaterial({
      classification: contract,
      lifecycleStage: SecurityMaterialLifecycleStages.development,
    })).toBeFalse();

    expect(isFailFastRequiredSecurityMaterial({
      classification: contract,
      lifecycleStage: SecurityMaterialLifecycleStages.production,
    })).toBeTrue();
  });

  it("rejects hierarchy contracts that conflict with classification scope", () => {
    expect(() => createSecurityMaterialClassificationContract({
      materialId: "material:user:transport-trust",
      category: SecurityMaterialCategories.transportTrust,
      scope: SecurityMaterialScopes.user,
      rotationPosture: SecurityMaterialRotationPostures.onDemand,
      usageContexts: [SecurityMaterialUsageContexts.runtimeRequest],
      hierarchy: Object.freeze({
        hierarchyClass: SecurityMaterialHierarchyClasses.userDeviceTrustMaterial,
        ownership: Object.freeze({
          ownerScope: SecurityMaterialScopes.server,
          ownerSubsystem: SecurityMaterialOwningSubsystems.userDeviceTrustService,
          storageSubsystem: SecurityMaterialStorageSubsystems.localUserSecureStore,
          consumerSubsystems: Object.freeze([SecurityMaterialConsumerSubsystems.userDeviceTrust]),
        }),
        lifecycle: Object.freeze({
          creationMode: SecurityMaterialCreationModes.externallyProvisioned,
          rotationMode: SecurityMaterialRotationModes.manual,
          revocationMode: SecurityMaterialRevocationModes.required,
          requiresReEncryptionOnRotation: false,
        }),
      }),
      defaultPolicy: {
        durabilityClass: SecurityMaterialDurabilityClasses.durable,
        startupRequirement: SecurityMaterialStartupRequirements.failFastRequired,
        fallbackPolicy: SecurityMaterialFallbackPolicies.none,
      },
    })).toThrow("does not match classification scope");
  });
});

