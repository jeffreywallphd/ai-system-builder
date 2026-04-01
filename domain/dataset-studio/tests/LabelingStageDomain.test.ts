import { describe, expect, it } from "bun:test";
import {
  AnnotationModeKinds,
  AnnotationTargetKinds,
  createLabelingStageConfig,
  parseLabelingStageConfigFromStageOptions,
  toLabelingStageOptions,
} from "../LabelingStageDomain";

describe("LabelingStageDomain", () => {
  it("creates valid assisted labeling config with annotation records", () => {
    const config = createLabelingStageConfig({
      mode: AnnotationModeKinds.assisted,
      target: AnnotationTargetKinds.record,
      allowMultiLabel: true,
      allowFreeText: true,
      confidenceEnabled: true,
      emitManualNeeded: true,
      records: Object.freeze([
        Object.freeze({
          annotationId: "ann-1",
          target: AnnotationTargetKinds.record,
          targetRef: "record:1",
          labels: Object.freeze(["positive", "priority"]),
          freeText: "needs review",
          confidence: 0.81,
          source: "seeded",
          status: "manual-needed",
        }),
      ]),
    });

    expect(config.mode).toBe("assisted");
    expect(config.records[0]?.status).toBe("manual-needed");
  });

  it("parses stage options and round-trips labeling options", () => {
    const parsed = parseLabelingStageConfigFromStageOptions(
      Object.freeze({
        labelingMode: "automatic-placeholder",
        annotationTarget: "chunk",
        annotationAttachmentMode: "associated",
        annotationAllowMultiLabel: false,
        annotationAllowFreeText: true,
        annotationConfidenceEnabled: false,
        annotationEmitManualNeeded: true,
      }),
      "text-items",
    );

    const options = toLabelingStageOptions(parsed);
    expect(parsed.mode).toBe("automatic-placeholder");
    expect(parsed.target).toBe("chunk");
    expect(options.annotationAttachmentMode).toBe("associated");
  });
});

