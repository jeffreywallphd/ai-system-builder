import { describe, expect, it } from "bun:test";
import { StudioHandoffFailureHandler } from "../StudioHandoffFailure";

describe("StudioHandoffFailureHandler", () => {
  it("classifies grouped compatibility failures with structured rejection metadata", () => {
    const handler = new StudioHandoffFailureHandler();
    const failure = handler.createFailure({
      stage: "input-adaptation",
      code: "input-adaptation-failed",
      message: "Grouped handoff failed compatibility.",
      issues: [{
        code: "bundle-asset-incompatible",
        message: "Bundled asset is incompatible.",
      }],
      compatibility: {
        compatible: false,
        targetStudioType: "system-studio",
        issues: [{
          code: "bundle-asset-incompatible",
          message: "Bundled asset is incompatible.",
        }],
      },
      context: {
        handoffId: "handoff:grouped-failure",
        sourceStudioId: "workflow-studio-default",
        sourceStudioType: "workflow-studio",
        targetStudioId: "system-studio-default",
        targetStudioType: "system-studio",
        impactedAssets: [{
          assetId: "asset:workflow",
          versionId: "asset:workflow:v2",
          role: "primary",
        }],
      },
    });

    expect(failure.kind).toBe("invalid-grouped-handoff");
    expect(failure.rejectionReason).toBe("grouped-input-rejected");
    expect(failure.context.handoffId).toBe("handoff:grouped-failure");
  });

  it("classifies version and system-of-systems failures distinctly", () => {
    const handler = new StudioHandoffFailureHandler();
    const versionFailure = handler.createFailure({
      stage: "input-adaptation",
      code: "input-adaptation-failed",
      message: "Version reference invalid.",
      issues: [{ code: "version-reference-invalid", message: "Version invalid." }],
      compatibility: {
        compatible: false,
        targetStudioType: "system-studio",
        issues: [{ code: "version-reference-invalid", message: "Version invalid." }],
      },
      context: {
        impactedAssets: [{ assetId: "system:child", versionId: "system:child:broken", role: "system-component" }],
      },
    });

    const systemFailure = handler.createFailure({
      stage: "input-adaptation",
      code: "input-adaptation-failed",
      message: "System taxonomy incompatible.",
      issues: [{ code: "taxonomy-incompatible", message: "Taxonomy not accepted." }],
      compatibility: {
        compatible: false,
        targetStudioType: "system-studio",
        issues: [{ code: "taxonomy-incompatible", message: "Taxonomy not accepted." }],
      },
      context: {
        impactedAssets: [{ assetId: "system:root", versionId: "system:root:v1", role: "system-component" }],
      },
    });

    expect(versionFailure.kind).toBe("version-reference-failure");
    expect(versionFailure.rejectionReason).toBe("version-reference-rejected");
    expect(systemFailure.kind).toBe("system-of-systems-failure");
    expect(systemFailure.rejectionReason).toBe("system-of-systems-rejected");
  });
});
