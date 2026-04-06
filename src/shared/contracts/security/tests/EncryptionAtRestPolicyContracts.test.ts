import { describe, expect, it } from "bun:test";
import {
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
  createEncryptedMaterialReference,
  createEncryptionAtRestPolicyDefinition,
  evaluateEncryptionAtRestPolicy,
} from "../../../../domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionAtRestPolicyContractError,
  serializeEncryptionPolicyRegistry,
  toEncryptedMaterialDescriptorDto,
  toEncryptionAtRestPolicyDefinitionDto,
  toEncryptionPolicyEvaluationResultDto,
  toMetadataProtectionConfigurationDto,
  toStorageInstanceEncryptionAtRestPolicyDto,
  toWorkspaceEncryptionAtRestPolicyDto,
} from "../EncryptionAtRestPolicyContracts";

describe("EncryptionAtRestPolicyContracts", () => {
  it("maps policy and evaluation domain models to stable DTOs", () => {
    const platform = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:contract",
      scope: EncryptionPolicyScopes.platform,
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMaterial,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.server,
        },
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.metadataOnly,
        },
      ],
    });

    const dto = toEncryptionAtRestPolicyDefinitionDto(platform);
    const evaluation = evaluateEncryptionAtRestPolicy({
      dataClass: ProtectedDataClasses.assetContent,
      platformPolicy: platform,
    });
    const evaluationDto = toEncryptionPolicyEvaluationResultDto(evaluation);

    expect(dto.scope).toBe(EncryptionPolicyScopes.platform);
    expect(dto.rules).toHaveLength(4);
    expect(dto.rules[0]?.decryption.allowPreviewDecryption).toBeFalse();
    expect(evaluationDto.dataClass).toBe(ProtectedDataClasses.assetContent);
    expect(evaluationDto.effectiveRule.encryptionMode).toBe(EncryptionModes.metadataOnly);
  });

  it("projects workspace and storage-instance scoped policy contracts", () => {
    const workspacePolicy = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:workspace:contract",
      scope: EncryptionPolicyScopes.workspace,
      workspaceId: "workspace-001",
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.workspace,
          decryption: {
            allowPreview: true,
          },
        },
      ],
    });

    const storagePolicy = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:storage:contract",
      scope: EncryptionPolicyScopes.storageInstance,
      workspaceId: "workspace-001",
      storageInstanceId: "storage-001",
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.storageInstance,
          decryption: {
            allowWorker: true,
          },
        },
      ],
    });

    const workspaceDto = toWorkspaceEncryptionAtRestPolicyDto(workspacePolicy);
    const storageDto = toStorageInstanceEncryptionAtRestPolicyDto(storagePolicy);

    expect(workspaceDto.workspaceId).toBe("workspace-001");
    expect(workspaceDto.metadataProtection.secretMetadata.dataClass).toBe(ProtectedDataClasses.secretMetadata);
    expect(storageDto.storageInstanceId).toBe("storage-001");
    expect(storageDto.metadataProtection.sensitiveMetadata.dataClass).toBe(ProtectedDataClasses.sensitiveMetadata);
  });

  it("projects encrypted material descriptors with policy scope metadata", () => {
    const storagePolicy = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:storage:descriptor",
      scope: EncryptionPolicyScopes.storageInstance,
      workspaceId: "workspace-001",
      storageInstanceId: "storage-001",
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.storageInstance,
          decryption: {
            allowPreview: true,
            allowWorker: true,
          },
        },
      ],
    });

    const descriptor = toEncryptedMaterialDescriptorDto({
      dataClass: ProtectedDataClasses.assetContent,
      policy: toEncryptionAtRestPolicyDefinitionDto(storagePolicy),
      reference: createEncryptedMaterialReference({
        materialId: "material-001",
        encryptedLocator: "storage-instance://storage-001/assets/material-001",
        algorithm: "aes-256-gcm",
        keyReferenceId: "key-001",
        keyScope: EncryptionKeyScopes.storageInstance,
        encryptedAt: "2026-04-06T10:00:00.000Z",
      }),
    });

    expect(descriptor.policyScope).toBe(EncryptionPolicyScopes.storageInstance);
    expect(descriptor.workspaceId).toBe("workspace-001");
    expect(descriptor.storageInstanceId).toBe("storage-001");
    expect(descriptor.reference.materialId).toBe("material-001");
  });

  it("rejects invalid policy dto projection inputs", () => {
    expect(() => toEncryptionAtRestPolicyDefinitionDto({
      policyId: "   ",
      scope: EncryptionPolicyScopes.platform,
      rules: [],
    })).toThrow(EncryptionAtRestPolicyContractError);

    expect(() => toMetadataProtectionConfigurationDto({
      policyId: "policy:missing:metadata",
      scope: EncryptionPolicyScopes.workspace,
      workspaceId: "workspace-001",
      rules: [],
    })).toThrow(EncryptionAtRestPolicyContractError);
  });

  it("serializes policy registry snapshots deterministically", () => {
    const platform = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:snapshot",
      scope: EncryptionPolicyScopes.platform,
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMaterial,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.server,
        },
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
      ],
    });

    const left = serializeEncryptionPolicyRegistry([platform]);
    const right = serializeEncryptionPolicyRegistry([platform]);

    expect(left).toBe(right);
    expect(JSON.parse(left)).toMatchObject({
      version: 1,
      policies: [
        {
          policyId: "policy:platform:snapshot",
          scope: EncryptionPolicyScopes.platform,
        },
      ],
    });
  });
});
