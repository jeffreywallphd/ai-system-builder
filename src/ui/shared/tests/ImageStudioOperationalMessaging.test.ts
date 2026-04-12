import { describe, expect, it } from "bun:test";
import {
  ImageStudioFailureMappingLayers,
  deriveImageStudioOperationalGuidance,
  mapImageStudioFailureCodeToClassification,
} from "../images/ImageStudioOperationalMessaging";
import { deriveImageManipulationRetryRecoveryContractFromClassification } from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";

describe("ImageStudioOperationalMessaging", () => {
  it("maps validation issue codes to user-fixable classification", () => {
    const classification = mapImageStudioFailureCodeToClassification({
      code: "invalid-request",
      fallbackLayer: ImageStudioFailureMappingLayers.executionDispatch,
    });
    expect(classification).toBeDefined();
    expect(classification?.kind).toBe("validation");
    expect(classification?.userFixable).toBeTrue();
  });

  it("maps timeout issue codes to retryable operational classification", () => {
    const classification = mapImageStudioFailureCodeToClassification({
      code: "dispatch-timeout",
      fallbackLayer: ImageStudioFailureMappingLayers.executionDispatch,
    });
    expect(classification).toBeDefined();
    expect(classification?.kind).toBe("operational");
    expect(classification?.disposition).toBe("retryable");
  });

  it("derives retry-later guidance from retryable recovery contracts", () => {
    const classification = mapImageStudioFailureCodeToClassification({
      code: "dispatch-timeout",
      fallbackLayer: ImageStudioFailureMappingLayers.executionDispatch,
    });
    const recovery = deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: true,
      retryAfterMs: 5000,
    });
    const guidance = deriveImageStudioOperationalGuidance({
      classification,
      recovery,
      fallbackSummary: "Run timed out.",
      launchReady: true,
    });

    expect(guidance.kind).toBe("wait-and-retry-later");
    expect(guidance.canRetryNow).toBeTrue();
    expect(guidance.temporary).toBeTrue();
  });

  it("classifies no-eligible-node guidance as temporary operational availability", () => {
    const classification = mapImageStudioFailureCodeToClassification({
      code: "execution-node-no-eligible-match",
      fallbackLayer: ImageStudioFailureMappingLayers.executionDispatch,
    });
    const guidance = deriveImageStudioOperationalGuidance({
      classification,
      fallbackSummary: "No execution node is currently eligible.",
      retryable: true,
      launchReady: false,
    });

    expect(guidance.kind).toBe("wait-and-retry-later");
    expect(guidance.temporary).toBeTrue();
    expect(guidance.statusSummary).toContain("no eligible execution node");
    expect(guidance.actionNow).toBe("wait");
  });

  it("classifies preview delay guidance distinctly from setup issues", () => {
    const classification = mapImageStudioFailureCodeToClassification({
      code: "im.preview.operational.preview-service-delayed",
      fallbackLayer: ImageStudioFailureMappingLayers.previewGeneration,
    });
    const guidance = deriveImageStudioOperationalGuidance({
      classification,
      fallbackSummary: "Preview generation is delayed.",
      retryable: true,
      launchReady: true,
    });

    expect(guidance.kind).toBe("wait-and-retry-later");
    expect(guidance.statusSummary).toContain("preview service is delayed");
    expect(guidance.actionNow).toBe("retry");
  });
});
