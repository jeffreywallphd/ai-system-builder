import { describe, expect, it } from "bun:test";
import {
  DataConverterDiagnosticSeverities,
  DataSourceReferenceKinds,
  createDataConverterDiagnostic,
  mergeDataConverterMetadata,
  normalizeDataConverterContext,
  resolveFormatFromReference,
} from "../DataConverterContracts";

describe("DataConverterContracts", () => {
  it("normalizes operation context and trims identifiers", () => {
    const context = normalizeDataConverterContext({
      requestId: " req-1 ",
      operationId: " op-1 ",
      lineageAssetId: " asset-1 ",
      attributes: { " key ": 1, "": "ignored" },
    });

    expect(context.requestId).toBe("req-1");
    expect(context.operationId).toBe("op-1");
    expect(context.lineageAssetId).toBe("asset-1");
    expect(context.attributes).toEqual({ key: 1 });
  });

  it("creates diagnostics with stable validation", () => {
    const diagnostic = createDataConverterDiagnostic({
      code: "invalid_input",
      severity: DataConverterDiagnosticSeverities.error,
      message: "Input is invalid.",
      path: "source.payload",
    });

    expect(diagnostic.code).toBe("invalid_input");
    expect(diagnostic.path).toBe("source.payload");
  });

  it("merges converter transformation metadata while preserving base metadata", () => {
    const metadata = mergeDataConverterMetadata({
      base: {
        schemaVersion: "1.0.0",
        source: { fileName: "users.csv", format: "csv" },
      },
      converterId: "converter-1",
      converterVersion: "1.0.1",
      operationId: "op-1",
    });

    expect(metadata.source?.fileName).toBe("users.csv");
    expect(metadata.transformation?.converterId).toBe("converter-1");
    expect(metadata.transformation?.converterVersion).toBe("1.0.1");
    expect(metadata.transformation?.transformationId).toBe("op-1");
  });

  it("infers source format from references when explicit hints are unavailable", () => {
    expect(resolveFormatFromReference({
      kind: DataSourceReferenceKinds.localFile,
      path: "C:\\tmp\\users.csv",
    })).toBe("csv");

    expect(resolveFormatFromReference({
      kind: DataSourceReferenceKinds.url,
      url: "https://example.com/data.json",
    })).toBe("json");
  });
});
