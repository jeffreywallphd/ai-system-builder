import { describe, expect, it } from "bun:test";
import {
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionAtRestPolicyContractVersions,
} from "../../../contracts/security/EncryptionAtRestPolicyContracts";
import {
  EncryptionAtRestPolicySchemaValidationError,
  parseEncryptedMaterialDescriptorDto,
  parseStorageInstanceEncryptionAtRestPolicyDto,
  parseUpsertStorageInstanceEncryptionAtRestPolicyRequestDto,
  parseWorkspaceEncryptionAtRestPolicyDto,
} from "../EncryptionAtRestPolicySchemaContracts";

describe("EncryptionAtRestPolicySchemaContracts", () => {
  it("parses valid workspace encryption policy payloads", () => {
    const parsed = parseWorkspaceEncryptionAtRestPolicyDto({
      policyId: "policy:workspace:001",
      scope: EncryptionPolicyScopes.workspace,
      workspaceId: "workspace-001",
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.workspace,
          decryption: {
            allowPreviewDecryption: true,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: true,
          allowWorkerDecryption: false,
        },
      ],
      metadataProtection: {
        secretMetadata: {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
        sensitiveMetadata: {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
      },
    });

    expect(parsed.scope).toBe(EncryptionPolicyScopes.workspace);
    expect(parsed.metadataProtection.secretMetadata.dataClass).toBe(ProtectedDataClasses.secretMetadata);
  });

  it("rejects malformed storage policy payloads", () => {
    expect(() => parseStorageInstanceEncryptionAtRestPolicyDto({
      policyId: "policy:storage:001",
      scope: EncryptionPolicyScopes.storageInstance,
      workspaceId: "workspace-001",
      rules: [
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.storageInstance,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: true,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
      ],
      metadataProtection: {
        secretMetadata: {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.metadataOnly,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
        sensitiveMetadata: {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
      },
    })).toThrow(EncryptionAtRestPolicySchemaValidationError);
  });

  it("parses encrypted material descriptors and validates scope linkage", () => {
    const descriptor = parseEncryptedMaterialDescriptorDto({
      contractVersion: EncryptionAtRestPolicyContractVersions.v1,
      dataClass: ProtectedDataClasses.assetContent,
      policyId: "policy:storage:001",
      policyScope: EncryptionPolicyScopes.storageInstance,
      workspaceId: "workspace-001",
      storageInstanceId: "storage-001",
      reference: {
        materialId: "material-001",
        encryptedLocator: "storage-instance://storage-001/assets/material-001",
        algorithm: "aes-256-gcm",
        keyReferenceId: "key-001",
        keyScope: EncryptionKeyScopes.storageInstance,
        encryptedAt: "2026-04-06T12:00:00.000Z",
      },
    });

    expect(descriptor.reference.materialId).toBe("material-001");

    expect(() => parseEncryptedMaterialDescriptorDto({
      contractVersion: EncryptionAtRestPolicyContractVersions.v1,
      dataClass: ProtectedDataClasses.assetContent,
      policyId: "policy:workspace:001",
      policyScope: EncryptionPolicyScopes.workspace,
      storageInstanceId: "storage-001",
      reference: {
        materialId: "material-001",
        encryptedLocator: "storage-instance://storage-001/assets/material-001",
        algorithm: "aes-256-gcm",
        keyReferenceId: "key-001",
        keyScope: EncryptionKeyScopes.storageInstance,
        encryptedAt: "2026-04-06T12:00:00.000Z",
      },
    })).toThrow(EncryptionAtRestPolicySchemaValidationError);
  });

  it("enforces policy identity consistency in storage upsert request DTO payloads", () => {
    expect(() => parseUpsertStorageInstanceEncryptionAtRestPolicyRequestDto({
      actorUserIdentityId: "user-001",
      workspaceId: "workspace-001",
      storageInstanceId: "storage-001",
      policy: {
        policyId: "policy:storage:001",
        scope: EncryptionPolicyScopes.storageInstance,
        workspaceId: "workspace-001",
        storageInstanceId: "storage-999",
        rules: [
          {
            dataClass: ProtectedDataClasses.secretMetadata,
            encryptionMode: EncryptionModes.metadataOnly,
            decryption: {
              allowPreviewDecryption: false,
              allowWorkerDecryption: false,
            },
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          {
            dataClass: ProtectedDataClasses.sensitiveMetadata,
            encryptionMode: EncryptionModes.metadataOnly,
            decryption: {
              allowPreviewDecryption: false,
              allowWorkerDecryption: false,
            },
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
        ],
        metadataProtection: {
          secretMetadata: {
            dataClass: ProtectedDataClasses.secretMetadata,
            encryptionMode: EncryptionModes.metadataOnly,
            decryption: {
              allowPreviewDecryption: false,
              allowWorkerDecryption: false,
            },
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          sensitiveMetadata: {
            dataClass: ProtectedDataClasses.sensitiveMetadata,
            encryptionMode: EncryptionModes.metadataOnly,
            decryption: {
              allowPreviewDecryption: false,
              allowWorkerDecryption: false,
            },
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
        },
      },
    })).toThrow(EncryptionAtRestPolicySchemaValidationError);
  });
});

