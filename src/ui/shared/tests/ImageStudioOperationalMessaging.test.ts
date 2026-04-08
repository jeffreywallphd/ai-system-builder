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
  });
});
