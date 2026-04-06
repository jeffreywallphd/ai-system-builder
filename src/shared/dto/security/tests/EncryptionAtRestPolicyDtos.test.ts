import { describe, expect, it } from "bun:test";
import {
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "../../../../domain/security/EncryptionAtRestPolicyDomain";
import {
  toGetEffectiveEncryptionAtRestPolicyResponseDto,
  toValidateEncryptedMaterialDescriptorResponseDto,
} from "../EncryptionAtRestPolicyDtos";

describe("EncryptionAtRestPolicyDtos", () => {
  it("creates an effective policy response payload", () => {
    const response = toGetEffectiveEncryptionAtRestPolicyResponseDto({
      evaluation: {
        dataClass: ProtectedDataClasses.assetContent,
        resolvedFrom: "workspace",
        inheritedFrom: ["platform"],
        encryptedAtRestRequired: true,
        requiresScopedContentKey: true,
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        effectiveRule: {
          dataClass: ProtectedDataClasses.assetContent,
          encryptionMode: EncryptionModes.scopedContent,
          decryption: {
            allowPreviewDecryption: false,
            allowWorkerDecryption: false,
          },
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
      },
      resolvedPolicy: {
        policyId: "policy:workspace:001",
        scope: EncryptionPolicyScopes.workspace,
        workspaceId: "workspace-001",
        rules: [],
      },
    });

    expect(response.resolvedPolicy.policyId).toBe("policy:workspace:001");
    expect(response.evaluation.dataClass).toBe(ProtectedDataClasses.assetContent);
  });

  it("normalizes descriptor validation response violations", () => {
    const response = toValidateEncryptedMaterialDescriptorResponseDto({
      valid: false,
      violations: ["keyScope mismatch"],
    });

    const noViolations = toValidateEncryptedMaterialDescriptorResponseDto({
      valid: true,
    });

    expect(response.violations).toEqual(["keyScope mismatch"]);
    expect(noViolations.violations).toEqual([]);
  });
});
