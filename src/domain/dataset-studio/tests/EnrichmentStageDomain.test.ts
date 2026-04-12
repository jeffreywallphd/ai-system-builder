import { describe, expect, it } from "bun:test";
import {
  EnrichmentStrategyKinds,
  createEnrichmentStageConfig,
  parseEnrichmentStageConfigFromStageOptions,
  toEnrichmentStageOptions,
} from "../EnrichmentStageDomain";

describe("EnrichmentStageDomain", () => {
  it("creates lookup strategy config with zod validation", () => {
    const config = createEnrichmentStageConfig({
      strategy: EnrichmentStrategyKinds.lookup,
      lookup: {
        inputKey: "id",
        lookupKey: "id",
        joinType: "left",
        preserveUnmatched: true,
      },
    });

    expect(config.strategy).toBe("lookup");
    expect(config.lookup?.joinType).toBe("left");
  });

  it("parses stage options into enrichment config and round-trips option mapping", () => {
    const parsed = parseEnrichmentStageConfigFromStageOptions(Object.freeze({
      enrichmentStrategy: "metadata-augmentation",
      enrichedFieldPrefix: "augmented",
      metadataIncludeImageMetadata: true,
      metadataIncludeDocumentStats: false,
      metadataIncludeProfiling: true,
    }));

    const options = toEnrichmentStageOptions(parsed);

    expect(parsed.strategy).toBe("metadata-augmentation");
    expect(options.enrichedFieldPrefix).toBe("augmented");
    expect(options.metadataIncludeDocumentStats).toBeFalse();
  });
});
