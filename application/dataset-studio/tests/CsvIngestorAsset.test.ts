import { describe, expect, it } from "bun:test";
import { CsvIngestorAsset } from "../CsvIngestorAsset";

describe("CsvIngestorAsset", () => {
  it("parses CSV into records with header normalization", () => {
    const ingestor = new CsvIngestorAsset();
    const result = ingestor.execute({
      payload: " Name , Score \nAda,10\nLin,8",
      config: {
        delimiter: ",",
        header: true,
        encoding: "utf-8",
        skipEmptyLines: true,
        normalizeHeadersToLowercase: true,
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful ingestion.");
    }
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.name).toBe("Ada");
    expect(result.records[0]?.score).toBe("10");
  });

  it("supports preview sampling and inferred schema", () => {
    const ingestor = new CsvIngestorAsset();
    const preview = ingestor.preview({
      payload: "id,name\n1,Ada\n2,Lin\n3,Zed",
      config: {
        header: true,
      },
    }, 2);

    if ("ok" in preview && !preview.ok) {
      throw new Error("Expected preview to succeed.");
    }

    expect(preview.sampleCount).toBe(2);
    expect(preview.totalCount).toBe(3);
    expect(preview.schema.map((field) => field.name)).toEqual(["id", "name"]);
  });

  it("returns structured diagnostics for malformed CSV", () => {
    const ingestor = new CsvIngestorAsset();
    const result = ingestor.execute({
      payload: "id,name\n\"unterminated,Ada",
      config: {
        header: true,
      },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected malformed CSV to fail.");
    }
    expect(result.diagnostics[0]?.code).toBe("csv-ingestor-invalid-csv");
  });
});
