import { describe, expect, it } from "bun:test";
import {
  ComfyRuntimeRequirementApplicability,
  ComfyRuntimeWorkflowProfiles,
  createComfyRuntimeAssetValidationResult,
  createComfyRuntimeCustomNodeRequirement,
  resolveComfyRuntimeCustomNodeInstallRequests,
  resolveComfyRuntimeCustomNodeRequirementsForProfile,
  resolveComfyRuntimeWorkflowProfile,
} from "../ComfyRuntimeRequirements";

describe("ComfyRuntimeRequirements", () => {
  it("filters custom node requirements by selected workflow profile", () => {
    const always = createComfyRuntimeCustomNodeRequirement({
      requirementId: "always-required-node",
      displayName: "Always Node",
      category: "custom-node",
      applicability: ComfyRuntimeRequirementApplicability.always,
      required: true,
      repository: {
        installerKind: "git",
        repositoryKind: "git",
        repositoryUri: "https://example.com/always.git",
        requestedRevision: "main",
        metadata: {},
      },
      metadata: {},
    });
    const faceId = createComfyRuntimeCustomNodeRequirement({
      requirementId: "faceid-required-node",
      displayName: "FaceID Node",
      category: "custom-node",
      applicability: ComfyRuntimeRequirementApplicability.faceIdOnly,
      required: true,
      repository: {
        installerKind: "git",
        repositoryKind: "git",
        repositoryUri: "https://example.com/faceid.git",
        requestedRevision: "main",
        metadata: {},
      },
      metadata: {},
    });

    const defaultProfile = resolveComfyRuntimeCustomNodeRequirementsForProfile({
      requirements: [always, faceId],
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
    });
    expect(defaultProfile.map((entry) => entry.requirementId)).toEqual(["always-required-node"]);

    const faceIdProfile = resolveComfyRuntimeCustomNodeRequirementsForProfile({
      requirements: [always, faceId],
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationFaceId,
    });
    expect(faceIdProfile.map((entry) => entry.requirementId)).toEqual([
      "always-required-node",
      "faceid-required-node",
    ]);
  });

  it("resolves deterministic install/update/status requests for custom nodes", () => {
    const requirement = createComfyRuntimeCustomNodeRequirement({
      requirementId: "faceid-required-node",
      displayName: "FaceID Node",
      category: "custom-node",
      applicability: ComfyRuntimeRequirementApplicability.faceIdOnly,
      required: true,
      repository: {
        installerKind: "git",
        repositoryKind: "git",
        repositoryUri: "https://example.com/faceid.git",
        requestedRevision: "main",
        metadata: {},
      },
      installLocationKey: "custom-node-faceid-required-node",
      metadata: {},
    });

    const resolved = resolveComfyRuntimeCustomNodeInstallRequests({
      requirement,
      targetRootDirectory: "/runtime/shared/custom_nodes",
    });
    expect(resolved.installRequest.runtimeDependencyId).toBe("runtime:comfyui:custom-node:faceid-required-node");
    expect(resolved.installRequest.installLocationKey).toBe("custom-node-faceid-required-node");
    expect(resolved.updateRequest.source.requestedRevision).toBe("main");
    expect(resolved.validationRequest.expectedRevision).toBe("main");
  });

  it("creates normalized validation summaries for runtime assets", () => {
    const result = createComfyRuntimeAssetValidationResult({
      workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationFaceId,
      entries: [
        {
          requirementId: "checkpoint-default",
          kind: "checkpoint",
          displayName: "Checkpoint model",
          required: true,
          applicability: "always",
          status: "present-valid",
          inspectedDirectory: "/runtime/models/checkpoints",
          issues: [],
        },
        {
          requirementId: "faceid-model",
          kind: "faceid-model",
          displayName: "FaceID model",
          required: true,
          applicability: "faceid-only",
          status: "missing-required",
          inspectedDirectory: "/runtime/models/insightface",
          issues: [],
        },
      ],
    });
    expect(result.valid).toBeFalse();
    expect(result.summary.total).toBe(2);
    expect(result.summary.presentValid).toBe(1);
    expect(result.summary.missingRequired).toBe(1);
  });

  it("normalizes workflow profile resolution with default fallback", () => {
    expect(resolveComfyRuntimeWorkflowProfile()).toBe(ComfyRuntimeWorkflowProfiles.imageManipulationDefault);
    expect(resolveComfyRuntimeWorkflowProfile("image-manipulation-faceid")).toBe(
      ComfyRuntimeWorkflowProfiles.imageManipulationFaceId,
    );
  });
});

