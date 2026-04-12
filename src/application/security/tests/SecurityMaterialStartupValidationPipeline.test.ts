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
} from "@application/security/contracts/SecurityMaterialClassificationContract";
import {
  SecurityMaterialPersistenceKinds,
  SecurityMaterialSourceKinds,
  SecurityMaterialStartupValidationIssueCodes,
  SecurityMaterialStartupValidationStates,
  runSecurityMaterialStartupValidationPipeline,
  type SecurityMaterialStartupValidationDescriptor,
} from "../services/SecurityMaterialStartupValidationPipeline";

describe("SecurityMaterialStartupValidationPipeline", () => {
  const descriptor = createSecurityMaterialClassificationContract({
    materialId: "material:test:durable-secret",
    category: SecurityMaterialCategories.secretCredential,
    scope: SecurityMaterialScopes.server,
    rotationPosture: SecurityMaterialRotationPostures.manual,
    usageContexts: [SecurityMaterialUsageContexts.startupBootstrap],
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
  });

  function createPipelineDescriptor(
    sourceKind: typeof SecurityMaterialSourceKinds[keyof typeof SecurityMaterialSourceKinds],
    lifecycleStage = SecurityMaterialLifecycleStages.production,
    present = true,
  ) {
    const descriptors: ReadonlyArray<SecurityMaterialStartupValidationDescriptor> = Object.freeze([{
      materialId: descriptor.materialId,
      classification: descriptor,
      resolveObservation: () => Object.freeze({
        materialId: descriptor.materialId,
        sourceKind,
        present,
        formatValid: true,
        persistence: sourceKind === SecurityMaterialSourceKinds.generatedEphemeral
          ? SecurityMaterialPersistenceKinds.ephemeral
          : SecurityMaterialPersistenceKinds.durable,
      }),
    }]);

    return runSecurityMaterialStartupValidationPipeline({
      context: Object.freeze({
        lifecycleStage,
        deploymentProfile: Object.freeze({
          profileId: "organization",
          environmentName: lifecycleStage,
          releaseChannel: lifecycleStage === SecurityMaterialLifecycleStages.production ? "stable" : "development",
        }),
        environment: Object.freeze({}),
      }),
      descriptors,
    });
  }

  it("marks pipeline invalid when production fail-fast material uses generated ephemeral fallback", () => {
    const result = createPipelineDescriptor(SecurityMaterialSourceKinds.generatedEphemeral);
    expect(result.state).toBe(SecurityMaterialStartupValidationStates.invalid);
    expect(result.fatalIssues.map((issue) => issue.code)).toContain(
      SecurityMaterialStartupValidationIssueCodes.nonDurableSource,
    );
    expect(result.productionCapable).toBeTrue();
  });

  it("keeps development pipeline ready and reports warning diagnostics for optional policy material", () => {
    const result = createPipelineDescriptor(
      SecurityMaterialSourceKinds.generatedEphemeral,
      SecurityMaterialLifecycleStages.development,
    );
    expect(result.state).toBe(SecurityMaterialStartupValidationStates.ready);
    expect(result.warnings.map((issue) => issue.code)).toContain(
      SecurityMaterialStartupValidationIssueCodes.nonDurableSource,
    );
    expect(result.fatalIssues).toHaveLength(0);
  });

  it("records missing material diagnostics when observation is absent", () => {
    const result = createPipelineDescriptor(
      SecurityMaterialSourceKinds.missing,
      SecurityMaterialLifecycleStages.production,
      false,
    );
    expect(result.state).toBe(SecurityMaterialStartupValidationStates.invalid);
    expect(result.issues.map((issue) => issue.code)).toContain(SecurityMaterialStartupValidationIssueCodes.missing);
  });
});
