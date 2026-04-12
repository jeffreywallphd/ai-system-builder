import { describe, expect, it } from "bun:test";
import {
  EncryptionAtRestPolicyDomainError,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
  assertEncryptedMaterialReferenceMatchesPolicy,
  createEncryptedMaterialReference,
  createEncryptionAtRestPolicyDefinition,
  createProtectedDataEncryptionRule,
  evaluateEncryptionAtRestPolicy,
} from "../EncryptionAtRestPolicyDomain";

describe("EncryptionAtRestPolicyDomain", () => {
  it("enforces always-encrypted secret material and strongly protected metadata invariants", () => {
    expect(() => createProtectedDataEncryptionRule({
      dataClass: ProtectedDataClasses.secretMaterial,
      encryptionMode: EncryptionModes.metadataOnly,
    })).toThrow(EncryptionAtRestPolicyDomainError);

    expect(() => createProtectedDataEncryptionRule({
      dataClass: ProtectedDataClasses.secretMetadata,
      encryptionMode: EncryptionModes.none,
    })).toThrow(EncryptionAtRestPolicyDomainError);

    expect(() => createProtectedDataEncryptionRule({
      dataClass: ProtectedDataClasses.sensitiveMetadata,
      encryptionMode: EncryptionModes.metadataOnly,
      decryption: {
        allowPreview: true,
      },
    })).toThrow(EncryptionAtRestPolicyDomainError);
  });

  it("requires explicit key scope for scoped-content encryption", () => {
    expect(() => createProtectedDataEncryptionRule({
      dataClass: ProtectedDataClasses.assetContent,
      encryptionMode: EncryptionModes.scopedContent,
    })).toThrow(EncryptionAtRestPolicyDomainError);

    const scoped = createProtectedDataEncryptionRule({
      dataClass: ProtectedDataClasses.assetContent,
      encryptionMode: EncryptionModes.scopedContent,
      keyScope: EncryptionKeyScopes.storageInstance,
      decryption: {
        allowPreview: true,
        allowWorker: true,
      },
    });

    expect(scoped.keyScope).toBe(EncryptionKeyScopes.storageInstance);
    expect(scoped.decryption.allowPreview).toBeTrue();
  });

  it("requires platform policy coverage for baseline protected classes", () => {
    expect(() => createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:missing-secret",
      scope: EncryptionPolicyScopes.platform,
      rules: [
        {
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
        {
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
        },
      ],
    })).toThrow(EncryptionAtRestPolicyDomainError);
  });

  it("resolves effective policy through platform, workspace, and storage-instance inheritance", () => {
    const platform = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:default",
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
          encryptionMode: EncryptionModes.none,
        },
      ],
    });

    const workspace = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:workspace:alpha",
      scope: EncryptionPolicyScopes.workspace,
      workspaceId: "workspace:alpha",
      rules: [
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.metadataOnly,
        },
      ],
    });

    const storage = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:storage:alpha-primary",
      scope: EncryptionPolicyScopes.storageInstance,
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:primary",
      rules: [
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.storageInstance,
          decryption: {
            allowPreview: true,
            allowWorker: false,
          },
        },
      ],
    });

    const result = evaluateEncryptionAtRestPolicy({
      dataClass: ProtectedDataClasses.assetContent,
      platformPolicy: platform,
      workspacePolicy: workspace,
      storageInstancePolicy: storage,
    });

    expect(result.effectiveRule.encryptionMode).toBe(EncryptionModes.scopedContent);
    expect(result.effectiveRule.keyScope).toBe(EncryptionKeyScopes.storageInstance);
    expect(result.resolvedFrom).toBe("storage-instance");
    expect(result.inheritedFrom).toEqual(["platform", "workspace"]);
    expect(result.allowPreviewDecryption).toBeTrue();
    expect(result.allowWorkerDecryption).toBeFalse();
  });

  it("rejects override rules that weaken inherited encryption posture", () => {
    const platform = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:strict",
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
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.workspace,
          decryption: {
            allowPreview: false,
            allowWorker: false,
          },
        },
      ],
    });

    const workspace = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:workspace:weaker",
      scope: EncryptionPolicyScopes.workspace,
      workspaceId: "workspace:beta",
      rules: [
        {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.metadataOnly,
        },
      ],
    });

    expect(() => evaluateEncryptionAtRestPolicy({
      dataClass: ProtectedDataClasses.assetContent,
      platformPolicy: platform,
      workspacePolicy: workspace,
    })).toThrow(EncryptionAtRestPolicyDomainError);
  });

  it("enforces encrypted material references when scoped-content is required", () => {
    const platform = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:secret-material",
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

    const evaluation = evaluateEncryptionAtRestPolicy({
      dataClass: ProtectedDataClasses.secretMaterial,
      platformPolicy: platform,
    });

    expect(() => assertEncryptedMaterialReferenceMatchesPolicy({
      evaluation,
      reference: undefined,
    })).toThrow(EncryptionAtRestPolicyDomainError);

    const reference = createEncryptedMaterialReference({
      materialId: "secret-material:1",
      encryptedLocator: "secret-payload://encrypted/1",
      algorithm: "aes-256-gcm",
      keyReferenceId: "kek:server:1",
      keyScope: EncryptionKeyScopes.server,
      encryptedAt: "2026-04-06T11:30:00.000Z",
    });

    expect(() => assertEncryptedMaterialReferenceMatchesPolicy({
      evaluation,
      reference,
    })).not.toThrow();
  });

  it("rejects encrypted material references with mismatched key scope", () => {
    const platform = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:asset",
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
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.workspace,
          decryption: {
            allowPreview: true,
            allowWorker: false,
          },
        },
      ],
    });

    const evaluation = evaluateEncryptionAtRestPolicy({
      dataClass: ProtectedDataClasses.assetContent,
      platformPolicy: platform,
    });

    const wrongReference = createEncryptedMaterialReference({
      materialId: "asset:1",
      encryptedLocator: "asset://encrypted/1",
      algorithm: "aes-256-gcm",
      keyReferenceId: "kek:server:1",
      keyScope: EncryptionKeyScopes.server,
      encryptedAt: "2026-04-06T11:30:00.000Z",
    });

    expect(() => assertEncryptedMaterialReferenceMatchesPolicy({
      evaluation,
      reference: wrongReference,
    })).toThrow(EncryptionAtRestPolicyDomainError);
  });
});
