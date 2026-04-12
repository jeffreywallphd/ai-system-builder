import { describe, expect, it } from "bun:test";
import {
  SecurityMaterialConsumerSubsystems,
  SecurityMaterialCreationModes,
  SecurityMaterialHierarchyClasses,
  SecurityMaterialOwningSubsystems,
  SecurityMaterialRevocationModes,
  SecurityMaterialRotationModes,
  SecurityMaterialStorageSubsystems,
  assertSecurityMaterialKeyHierarchyCompatibility,
  createSecurityMaterialKeyHierarchyContract,
} from "@application/security/contracts/SecurityMaterialKeyHierarchyContract";

describe("SecurityMaterialKeyHierarchyContract", () => {
  it("creates a valid token-signing hierarchy contract", () => {
    const contract = createSecurityMaterialKeyHierarchyContract({
      hierarchyClass: SecurityMaterialHierarchyClasses.tokenSigningKey,
      ownership: Object.freeze({
        ownerScope: "server",
        ownerSubsystem: SecurityMaterialOwningSubsystems.identitySessionService,
        storageSubsystem: SecurityMaterialStorageSubsystems.durableServerSecretStore,
        consumerSubsystems: Object.freeze([SecurityMaterialConsumerSubsystems.identityTokenIssuance]),
      }),
      lifecycle: Object.freeze({
        creationMode: SecurityMaterialCreationModes.generatedAtBootstrap,
        rotationMode: SecurityMaterialRotationModes.onCompromise,
        revocationMode: SecurityMaterialRevocationModes.required,
        requiresReEncryptionOnRotation: false,
        rotationPolicy: Object.freeze({
          rotationMode: "on-compromise",
          cutoverStrategy: "immediate",
        }),
      }),
    });

    expect(contract.hierarchyClass).toBe(SecurityMaterialHierarchyClasses.tokenSigningKey);
    expect(contract.ownership.ownerScope).toBe("server");
    expect(contract.lifecycle.rotationPolicy?.rotationMode).toBe("on-compromise");
  });

  it("rejects hierarchy classes that do not allow the supplied category", () => {
    const contract = createSecurityMaterialKeyHierarchyContract({
      hierarchyClass: SecurityMaterialHierarchyClasses.workspaceEncryptionMaterial,
      ownership: Object.freeze({
        ownerScope: "workspace",
        ownerSubsystem: SecurityMaterialOwningSubsystems.workspaceSecurityService,
        storageSubsystem: SecurityMaterialStorageSubsystems.workspaceSecretStore,
        consumerSubsystems: Object.freeze([SecurityMaterialConsumerSubsystems.workspaceEncryption]),
      }),
      lifecycle: Object.freeze({
        creationMode: SecurityMaterialCreationModes.externallyProvisioned,
        rotationMode: SecurityMaterialRotationModes.scheduled,
        revocationMode: SecurityMaterialRevocationModes.required,
        requiresReEncryptionOnRotation: true,
      }),
    });

    expect(() => assertSecurityMaterialKeyHierarchyCompatibility({
      materialId: "material:workspace:encryption:primary",
      hierarchy: contract,
      scope: "workspace",
      category: "signing-material",
    })).toThrow("does not allow category");
  });
});
