import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  type CanonicalDataShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetSchemaIntentIds,
  createSchemaIntentValidationIssue,
  createSchemaIntentValidationResult,
  type IDatasetSchemaIntent,
} from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { MediaSchemaIntentAdapter } from "../adapters/schema-intents/MediaSchemaIntentAdapter";
import { DatasetSchemaValidationEngine } from "../DatasetSchemaValidationEngine";

describe("DatasetSchemaValidationEngine", () => {
  it("validates canonical media records via schema-intent adapters", () => {
    const engine = new DatasetSchemaValidationEngine();
    const intent = new MediaSchemaIntentAdapter();

    const result = engine.validate({
      intent,
      shape: createCanonicalRecordsShape({
        records: [{
          recordId: "record-1",
          fields: {
            assetRef: { assetId: "asset:image:media-engine" },
            width: 640,
            height: 480,
            format: "png",
          },
        }],
      }),
    });

    expect(result.valid).toBeTrue();
    expect(result.intentId).toBe("media");
    expect(result.summary.errorCount).toBe(0);
  });

  it("surfaces media validation failures with inspectable summary counts", () => {
    const engine = new DatasetSchemaValidationEngine();
    const intent = new MediaSchemaIntentAdapter();

    const result = engine.validate({
      intent,
      shape: createCanonicalRecordsShape({
        records: [{
          recordId: "record-1",
          fields: {
            assetRef: { assetId: "asset:image:media-engine-invalid" },
            width: -10,
            height: 480,
            format: "bmp",
          },
        }],
      }),
    });

    expect(result.valid).toBeFalse();
    expect(result.summary.errorCount).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.code.startsWith("schema-intent.media."))).toBeTrue();
  });

  it("operates through internal schema-intent contracts, independent of concrete validation libraries", () => {
    const engine = new DatasetSchemaValidationEngine();
    const stubIntent: IDatasetSchemaIntent = {
      descriptor: {
        id: DatasetSchemaIntentIds.semantic,
        name: "Stub Semantic",
        description: "Stub intent for contract-level validation testing.",
        contractVersion: "1.0.0",
        supportedShapeKinds: ["records"],
      },
      validateShape: (_shape: CanonicalDataShape) => createSchemaIntentValidationResult([
        createSchemaIntentValidationIssue({
          code: "schema-intent.stub.warning",
          message: "Stub warning.",
          severity: "warning",
        }),
      ]),
    };

    const result = engine.validate({
      intent: stubIntent,
      shape: createCanonicalRecordsShape({ records: [] }),
    });

    expect(result.valid).toBeTrue();
    expect(result.summary.warningCount).toBe(1);
    expect(result.summary.errorCount).toBe(0);
  });
});
