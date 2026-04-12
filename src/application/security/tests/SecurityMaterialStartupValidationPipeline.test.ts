import { describe, expect, it } from "bun:test";
import {
  SecurityMaterialConsumerSubsystems,
  SecurityMaterialCreationModes,
  SecurityMaterialHierarchyClasses,
  SecurityMaterialOwningSubsystems,
  SecurityMaterialRevocationModes,
  SecurityMaterialRotationModes,
  SecurityMaterialStorageSubsystems,
} from "@application/security/contracts/SecurityMaterialKeyHierarchyContract";
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
    hierarchy: Object.freeze({
      hierarchyClass: SecurityMaterialHierarchyClasses.serverRuntimeSecretMaterial,
      ownership: Object.freeze({
        ownerScope: SecurityMaterialScopes.server,
        ownerSubsystem: SecurityMaterialOwningSubsystems.serverControlPlane,
        storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
        consumerSubsystems: Object.freeze([SecurityMaterialConsumerSubsystems.serverBootstrap]),
      }),
      lifecycle: Object.freeze({
        creationMode: SecurityMaterialCreationModes.generatedAtBootstrap,
        rotationMode: SecurityMaterialRotationModes.onCompromise,
        revocationMode: SecurityMaterialRevocationModes.optional,
        requiresReEncryptionOnRotation: false,
      }),
    }),
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
    expect(result.governanceAssertions.blocked).toBeGreaterThan(0);
    expect(result.governanceAssertions.entries.some((entry) => (
      entry.allowanceKind === "ephemeral-bootstrap-material"
      && entry.enforcement === "blocked"
    ))).toBeTrue();
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
    expect(result.governanceAssertions.warning).toBeGreaterThan(0);
    expect(result.governanceAssertions.entries.some((entry) => (
      entry.allowanceKind === "relaxed-validation-mode"
      && entry.enforcement === "warning"
    ))).toBeTrue();
  });

  it("records missing material diagnostics when observation is absent", () => {
    const result = createPipelineDescriptor(
      SecurityMaterialSourceKinds.missing,
      SecurityMaterialLifecycleStages.production,
      false,
    );
    expect(result.state).toBe(SecurityMaterialStartupValidationStates.invalid);
    expect(result.issues.map((issue) => issue.code)).toContain(SecurityMaterialStartupValidationIssueCodes.missing);
    expect(result.governanceAssertions.total).toBe(0);
  });
});
