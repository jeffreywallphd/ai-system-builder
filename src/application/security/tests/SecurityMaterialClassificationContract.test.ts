import { describe, expect, it } from "bun:test";
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
});

