import { describe, expect, it } from "bun:test";
import {
  ProtectedDataClasses,
  type EncryptionPolicyEvaluationSource,
  type ProtectedDataClass,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import type {
  ContentEncryptionRequirementDecision,
  EffectiveEncryptionPolicyEvaluation,
  EncryptionPolicyEvaluationServiceResult,
  IEncryptionPolicyEvaluationService,
  PreviewDecryptionAllowanceDecision,
  WorkerDecryptionAllowanceDecision,
} from "../use-cases/EncryptionPolicyEvaluationServiceContracts";

class StubEncryptionPolicyEvaluationService implements IEncryptionPolicyEvaluationService {
  public async evaluateEffectivePolicy(): Promise<
    EncryptionPolicyEvaluationServiceResult<EffectiveEncryptionPolicyEvaluation>
  > {
    return {
      ok: true,
      value: createEffective(ProtectedDataClasses.assetContent, "workspace"),
    };
  }

  public async evaluateContentEncryptionRequirement(): Promise<
    EncryptionPolicyEvaluationServiceResult<ContentEncryptionRequirementDecision>
  > {
    return {
      ok: true,
      value: {
        dataClass: ProtectedDataClasses.assetContent,
        required: true,
        keyScope: "workspace",
        resolvedFrom: "workspace",
      },
    };
  }

  public async evaluatePreviewDecryptionAllowance(): Promise<
    EncryptionPolicyEvaluationServiceResult<PreviewDecryptionAllowanceDecision>
  > {
    return {
      ok: true,
      value: {
        dataClass: ProtectedDataClasses.assetContent,
        allowed: true,
        resolvedFrom: "workspace",
      },
    };
  }

  public async evaluateWorkerDecryptionAllowance(): Promise<
    EncryptionPolicyEvaluationServiceResult<WorkerDecryptionAllowanceDecision>
  > {
    return {
      ok: true,
      value: {
        dataClass: ProtectedDataClasses.assetContent,
        allowed: true,
        resolvedFrom: "workspace",
      },
    };
  }
}

describe("EncryptionPolicyEvaluationService contracts", () => {
  it("supports storage, asset, secret, and preview service consumption seams", async () => {
    const evaluator: IEncryptionPolicyEvaluationService = new StubEncryptionPolicyEvaluationService();

    const storagePolicy = await evaluator.evaluateContentEncryptionRequirement({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:primary",
    });
    expect(storagePolicy.ok).toBeTrue();
    if (!storagePolicy.ok) {
      return;
    }
    expect(storagePolicy.value.required).toBeTrue();

    const assetPolicy = await evaluator.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(assetPolicy.ok).toBeTrue();

    const secretPolicy = await evaluator.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.secretMaterial,
      workspaceId: "workspace:alpha",
    });
    expect(secretPolicy.ok).toBeTrue();

    const previewPolicy = await evaluator.evaluatePreviewDecryptionAllowance({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(previewPolicy.ok).toBeTrue();
    if (!previewPolicy.ok) {
      return;
    }
    expect(previewPolicy.value.allowed).toBeTrue();
  });
});

function createEffective(
  dataClass: ProtectedDataClass,
  resolvedFrom: EncryptionPolicyEvaluationSource,
): EffectiveEncryptionPolicyEvaluation {
  return {
    dataClass,
    evaluation: {
      dataClass,
      effectiveRule: {
        dataClass,
        encryptionMode: "scoped-content",
        keyScope: "workspace",
        decryption: {
          allowPreview: true,
          allowWorker: true,
        },
      },
      resolvedFrom,
      inheritedFrom: ["platform"],
      encryptedAtRestRequired: true,
      requiresScopedContentKey: true,
      allowPreviewDecryption: true,
      allowWorkerDecryption: true,
    },
    effectiveRule: {
      dataClass,
      encryptionMode: "scoped-content",
      keyScope: "workspace",
      decryption: {
        allowPreview: true,
        allowWorker: true,
      },
    },
    resolvedFrom,
    inheritedFrom: ["platform"],
    encryptedAtRestRequired: true,
    contentEncryptionRequired: true,
    keyScope: "workspace",
    allowPreviewDecryption: true,
    allowWorkerDecryption: true,
  };
}

