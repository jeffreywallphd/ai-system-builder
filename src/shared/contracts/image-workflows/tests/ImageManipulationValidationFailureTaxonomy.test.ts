import { describe, expect, it } from "bun:test";
import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  ImageManipulationIssueResolutionActors,
  createImageManipulationIssueClassification,
  createImageManipulationIssueCode,
  parseImageManipulationIssueCode,
} from "../ImageManipulationValidationFailureTaxonomy";

describe("ImageManipulationValidationFailureTaxonomy", () => {
  it("defines canonical layer taxonomy for all image-manipulation failure seams", () => {
    expect(ImageManipulationIssueLayers.assetIngestion).toBe("asset-ingestion");
    expect(ImageManipulationIssueLayers.workflowConfiguration).toBe("workflow-configuration");
    expect(ImageManipulationIssueLayers.runReadiness).toBe("run-readiness");
    expect(ImageManipulationIssueLayers.executionDispatch).toBe("execution-dispatch");
    expect(ImageManipulationIssueLayers.nodeAvailability).toBe("node-availability");
    expect(ImageManipulationIssueLayers.resultCollection).toBe("result-collection");
    expect(ImageManipulationIssueLayers.previewGeneration).toBe("preview-generation");
    expect(ImageManipulationIssueLayers.protectedRetrieval).toBe("protected-retrieval");
  });

  it("builds and parses stable machine-readable issue codes", () => {
    const issueCode = createImageManipulationIssueCode({
      layer: ImageManipulationIssueLayers.resultCollection,
      kind: ImageManipulationIssueKinds.operational,
      reason: "partial-output-anomaly",
    });
    expect(issueCode).toBe("im.result.operational.partial-output-anomaly");
    expect(parseImageManipulationIssueCode(issueCode)).toEqual({
      layer: "result-collection",
      kind: "operational",
      reason: "partial-output-anomaly",
    });
    expect(parseImageManipulationIssueCode("im.invalid.operational.test")).toBeUndefined();
  });

  it("supports user-fixable validation classification", () => {
    const classification = createImageManipulationIssueClassification({
      layer: ImageManipulationIssueLayers.workflowConfiguration,
      kind: ImageManipulationIssueKinds.validation,
      summaryCategory: ImageManipulationFailureSummaryCategories.validation,
      disposition: ImageManipulationFailureDispositions.terminal,
      reason: "invalid-parameter-binding",
    });

    expect(classification.userFixable).toBeTrue();
    expect(classification.degraded).toBeFalse();
    expect(classification.resolutionActor).toBe(ImageManipulationIssueResolutionActors.user);
    expect(classification.disposition).toBe("terminal");
  });

  it("supports retryable degraded operational classification", () => {
    const classification = createImageManipulationIssueClassification({
      layer: ImageManipulationIssueLayers.nodeAvailability,
      kind: ImageManipulationIssueKinds.operational,
      summaryCategory: ImageManipulationFailureSummaryCategories.connectivity,
      disposition: ImageManipulationFailureDispositions.retryable,
      reason: "node-heartbeat-stale",
      userFixable: false,
      degraded: true,
    });

    expect(classification.userFixable).toBeFalse();
    expect(classification.degraded).toBeTrue();
    expect(classification.disposition).toBe("retryable");
    expect(classification.resolutionActor).toBe(ImageManipulationIssueResolutionActors.operator);
  });
});
