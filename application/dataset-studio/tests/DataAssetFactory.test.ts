import { describe, expect, it } from "bun:test";
import { DataAssetFactory } from "../DataAssetFactory";
import { DataConverterCore } from "../DataConverterCore";
import { DefaultDataAssetExecutionFramework } from "../DataAssetExecutionFramework";

describe("DataAssetFactory", () => {
  it("creates canonical data assets from successful converter results", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: "source-to-records",
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: JSON.stringify([{ id: "1", name: "Ada" }]),
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
      context: {
        lineageAssetId: "source-asset",
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("expected successful conversion");
    }

    const factory = new DataAssetFactory();
    const asset = factory.createFromConverterResult({
      assetId: "dataset-canonical-1",
      name: "Canonical Dataset",
      version: "v1",
    }, result);

    expect(asset.kind).toBe("dataset");
    expect(asset.toCanonicalDataShape().kind).toBe("records");
    expect(asset.inspect().outputShapeKind).toBe("records");
  });

  it("creates previews from conversion results through the shared engine", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: "source-to-records",
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: JSON.stringify([{ id: "1", name: "Ada" }]),
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
    });

    const factory = new DataAssetFactory();
    const preview = factory.createPreviewFromConverterResult(result, { maxItems: 1 });

    expect(preview.kind).toBe("records");
    expect(preview.summary.sampleCount).toBe(1);
  });

  it("rejects failed conversion results when creating data assets", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: "source-to-records",
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: "",
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeFalse();

    const factory = new DataAssetFactory();
    expect(() => factory.createFromConverterResult({
      assetId: "dataset-invalid",
      name: "Invalid",
    }, result)).toThrow("Cannot create data asset");
  });

  it("creates canonical data assets from successful execution results", async () => {
    const converter = new DataConverterCore();
    const conversionResult = converter.convert({
      operation: "source-to-records",
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: JSON.stringify([{ id: "1", city: "Boston" }]),
        formatHint: "json",
        sourceAssetId: "source-cities",
        diagnostics: Object.freeze([]),
      },
    });

    expect(conversionResult.ok).toBeTrue();
    if (!conversionResult.ok) {
      throw new Error("expected successful conversion");
    }

    const sourceAsset = new DataAssetFactory().createFromConverterResult({
      assetId: "dataset-source-1",
      name: "Source Dataset",
      version: "v1",
    }, conversionResult);

    const execution = new DefaultDataAssetExecutionFramework({
      converter,
      now: () => new Date("2026-03-31T13:45:00.000Z"),
      executionIdFactory: () => "exec-factory-1",
    });

    const executionResult = await execution.execute({
      asset: sourceAsset,
      input: {
        kind: "converter-result",
        result: conversionResult,
      },
    });

    const factory = new DataAssetFactory();
    const asset = factory.createFromExecutionResult({
      assetId: "dataset-from-execution",
      name: "Execution Dataset",
      version: "v2",
    }, executionResult);

    expect(asset.kind).toBe("dataset");
    expect(asset.toCanonicalDataShape().kind).toBe("records");
    expect(asset.source.executionId).toBe("exec-factory-1");
  });
});
