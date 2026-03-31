import { describe, expect, it } from "bun:test";
import { JsonIngestorAsset } from "../JsonIngestorAsset";

describe("JsonIngestorAsset", () => {
  it("normalizes single-object input into one record", () => {
    const ingestor = new JsonIngestorAsset();
    const result = ingestor.execute({
      payload: "{\"id\":\"1\",\"name\":\"Ada\"}",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful JSON ingestion.");
    }
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.name).toBe("Ada");
  });

  it("supports flatten mode with max depth", () => {
    const ingestor = new JsonIngestorAsset();
    const result = ingestor.execute({
      payload: [{ user: { name: "Ada", profile: { level: 3 } } }],
      config: {
        flatten: true,
        maxDepth: 4,
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful JSON flattening.");
    }
    expect(result.records[0]?.["user.name"]).toBe("Ada");
    expect(result.records[0]?.["user.profile.level"]).toBe(3);
  });

  it("returns structured diagnostics for unsupported JSON shapes", () => {
    const ingestor = new JsonIngestorAsset();
    const result = ingestor.execute({
      payload: "[1,2,3]",
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected unsupported JSON shape to fail.");
    }
    expect(result.diagnostics[0]?.code).toBe("json-ingestor-unsupported-shape");
    expect(result.normalized.issues[0]?.category).toBe("parse-extraction-failure");
  });

  it("returns bounded preview envelopes with truncation warnings", () => {
    const ingestor = new JsonIngestorAsset();
    const preview = ingestor.preview({
      payload: JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]),
    }, 2);

    if ("ok" in preview && !preview.ok) {
      throw new Error("Expected preview to succeed.");
    }
    expect(preview.normalized.summary.sampleCount).toBe(2);
    expect(preview.normalized.summary.totalCount).toBe(3);
    expect(preview.normalized.issues[0]?.code).toBe("json-ingestor-preview-truncated");
  });
});
