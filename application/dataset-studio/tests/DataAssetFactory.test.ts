import { describe, expect, it } from "bun:test";
import { DataAssetFactory } from "../DataAssetFactory";
import { DataConverterCore } from "../DataConverterCore";


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
});

