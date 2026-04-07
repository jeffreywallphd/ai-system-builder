import { describe, expect, it } from "bun:test";
import { UnifiedIngestionOutputTargetKinds } from "@domain/dataset-studio/UnifiedIngestionDomain";
import { resolveUnifiedIngestionConfiguration } from "../UnifiedIngestionConfiguration";

describe("UnifiedIngestionConfiguration", () => {
  it("defaults simple mode to canonical records target with bounded preview defaults", () => {
    const resolved = resolveUnifiedIngestionConfiguration();
    expect(resolved.configuration.mode).toBe("simple");
    expect(resolved.configuration.outputTarget).toBe(UnifiedIngestionOutputTargetKinds.records);
    expect(resolved.configuration.previewSampleLimit).toBe(25);
    expect(resolved.issues).toHaveLength(0);
  });

  it("resolves advanced overrides through shared config contract", () => {
    const resolved = resolveUnifiedIngestionConfiguration({
      mode: "advanced",
      values: {
        strategy: "json",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
        flattenJson: true,
        flattenJsonDepth: 3,
        imageTags: ["vision", "curated"],
        imageAnnotations: { caption: "Sample frame" },
        enableContentSniffing: false,
      },
    });

    expect(resolved.configuration.mode).toBe("advanced");
    if (resolved.configuration.mode === "advanced") {
      expect(resolved.configuration.strategy).toBe("json");
      expect(resolved.configuration.flattenJsonDepth).toBe(3);
      expect(resolved.configuration.imageTags).toEqual(["vision", "curated"]);
      expect(resolved.configuration.imageAnnotations).toEqual({ caption: "Sample frame" });
      expect(resolved.configuration.enableContentSniffing).toBeFalse();
    }
    expect(resolved.issues).toHaveLength(0);
  });

  it("prevents contradictory advanced settings", () => {
    const resolved = resolveUnifiedIngestionConfiguration({
      mode: "advanced",
      values: {
        strategy: "document",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
        flattenJsonDepth: 2,
        flattenJson: false,
      },
    });

    expect(resolved.issues.some((issue) => issue.code === "unified-ingestion-config-output-target-strategy-mismatch")).toBeTrue();
    expect(resolved.issues.some((issue) => issue.code === "unified-ingestion-config-flatten-depth-requires-flatten")).toBeTrue();
  });

  it("preserves advanced values when switching modes via shared base resolution", () => {
    const advanced = resolveUnifiedIngestionConfiguration({
      mode: "advanced",
      values: {
        strategy: "image",
        outputTarget: UnifiedIngestionOutputTargetKinds.imageMetadataRecords,
        imageExtractExif: false,
      },
    });
    expect(advanced.issues).toHaveLength(0);

    const simple = resolveUnifiedIngestionConfiguration({
      mode: "simple",
      base: advanced.configuration,
    });
    expect(simple.configuration.mode).toBe("simple");

    const restoredAdvanced = resolveUnifiedIngestionConfiguration({
      mode: "advanced",
      base: advanced.configuration,
    });
    expect(restoredAdvanced.configuration.mode).toBe("advanced");
    if (restoredAdvanced.configuration.mode === "advanced") {
      expect(restoredAdvanced.configuration.strategy).toBe("image");
      expect(restoredAdvanced.configuration.imageExtractExif).toBeFalse();
    }
  });
});

