import { describe, expect, it } from "bun:test";
import {
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
  createEncryptionAtRestPolicyDefinition,
  evaluateEncryptionAtRestPolicy,
} from "../../../../domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionAtRestPolicyContractError,
  serializeEncryptionPolicyRegistry,
  toEncryptionAtRestPolicyDefinitionDto,
  toEncryptionPolicyEvaluationResultDto,
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
    expect(evaluationDto.dataClass).toBe(ProtectedDataClasses.assetContent);
    expect(evaluationDto.effectiveRule.encryptionMode).toBe(EncryptionModes.metadataOnly);
  });

  it("rejects invalid policy dto projection inputs", () => {
    expect(() => toEncryptionAtRestPolicyDefinitionDto({
      policyId: "   ",
      scope: EncryptionPolicyScopes.platform,
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
