import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataAsset } from "@domain/dataset-studio/CanonicalDataAsset";
import { DataConverterCore } from "../DataConverterCore";
import { DataSourceReferenceKinds } from "../DataConverterContracts";
import {
  DataAssetExecutionStatuses,
  DefaultDataAssetExecutionFramework,
} from "../DataAssetExecutionFramework";

function createRecordsAsset(): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: "dataset-exec-asset",
    name: "Dataset Exec Asset",
    version: "v1",
    source: { type: "generated", workflowId: "wf-1" },
    location: { accessMethod: "virtual", location: "dataset://exec" },
    outputShape: createCanonicalRecordsShape({
      records: [{ recordId: "seed-1", fields: { id: "1", name: "Seed" } }],
    }),
  });
}

function createImageAsset(): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: "dataset-image-asset",
    name: "Dataset Image Asset",
    version: "1.0.0",
    source: { type: "generated", workflowId: "wf-image" },
    location: { accessMethod: "virtual", location: "dataset://image" },
    outputShape: createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-1",
        attributes: {
          assetRef: {
            assetId: "asset:image:img-1",
          },
          width: 100,
          height: 50,
          format: "png",
          tags: ["hero"],
        },
      }, {
        itemId: "img-2",
        attributes: {
          assetRef: {
            assetId: "asset:image:img-2",
          },
          width: 200,
          height: 120,
          format: "jpeg",
        },
      }],
    }),
  });
}

describe("DefaultDataAssetExecutionFramework", () => {
  it("executes a data asset from source-reference input and emits preview + lineage", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      converter: new DataConverterCore(),
      now: () => new Date("2026-03-31T13:00:00.000Z"),
      executionIdFactory: () => "exec-1",
    });

    const result = await framework.execute({
      asset: createRecordsAsset(),
      input: {
        kind: "source-reference",
        source: {
          kind: DataSourceReferenceKinds.inMemory,
          payload: JSON.stringify([{ id: "2", name: "Ada" }]),
          formatHint: "json",
          sourceAssetId: "source-users",
          sourceVersionId: "v9",
        },
      },
      context: {
        requestId: "req-1",
        operationId: "op-1",
      },
      requestedBy: "unit-test",
    });

    expect(result.ok).toBeTrue();
    expect(result.status).toBe(DataAssetExecutionStatuses.succeeded);
    expect(result.output?.kind).toBe("records");
    expect(result.preview.kind).toBe("records");
    expect(result.validationIssues.length).toBe(0);
    expect(result.failure).toBeUndefined();
    expect(result.context.executionId).toBe("exec-1");
    expect(result.lineage.execution.requestId).toBe("req-1");
    expect(result.lineage.inputs.some((entry) => entry.assetId === "source-users")).toBeTrue();
    expect(result.lineage.steps.some((entry) => entry.kind === "resolve-source")).toBeTrue();
    expect(result.ingestionLog.asset.assetId).toBe("dataset-exec-asset");
    expect(result.ingestionLineage.producer.assetId).toBe("dataset-exec-asset");
  });

  it("supports converter-request execution paths", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      converter: new DataConverterCore(),
      now: () => new Date("2026-03-31T13:10:00.000Z"),
      executionIdFactory: () => "exec-2",
    });

    const converter = new DataConverterCore();
    const seed = converter.convertFileLikeSourceToRecords({
      formatHint: "json",
      content: JSON.stringify([{ id: "3", name: "Lin", score: 8 }]),
    });

    const result = await framework.execute({
      asset: createRecordsAsset(),
      input: {
        kind: "converter-request",
        request: {
          operation: "records-to-table",
          records: seed,
        },
      },
    });

    expect(result.ok).toBeFalse();
    expect(result.status).toBe(DataAssetExecutionStatuses.failed);
    expect(result.diagnostics[0]?.code).toBe("output_shape_mismatch");
    expect(result.validationIssues.some((issue) => issue.code === "output_shape_mismatch")).toBeTrue();
    expect(result.failure?.kind).toBe("validation");
  });

  it("fails with structured diagnostics when converter result is unsuccessful", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      converter: new DataConverterCore(),
      now: () => new Date("2026-03-31T13:20:00.000Z"),
      executionIdFactory: () => "exec-3",
    });

    const failedConverterResult = new DataConverterCore().convert({
      operation: "source-to-records",
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: "",
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
    });

    const result = await framework.execute({
      asset: createRecordsAsset(),
      input: {
        kind: "converter-result",
        result: failedConverterResult,
      },
    });

    expect(result.ok).toBeFalse();
    expect(result.status).toBe(DataAssetExecutionStatuses.failed);
    expect(result.preview.kind).toBe("error");
    expect(result.lineage.diagnostics?.[0]?.severity).toBe("error");
    expect(result.failure?.kind).toBe("validation");
    expect(result.ingestionLog.status).toBe("failed");
  });

  it("can package preview-only execution from a data asset canonical output", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      now: () => new Date("2026-03-31T13:30:00.000Z"),
      executionIdFactory: () => "exec-4",
    });

    const result = await framework.execute({
      asset: createRecordsAsset(),
    });

    expect(result.ok).toBeTrue();
    expect(result.preview.kind).toBe("records");
    expect(result.lineage.steps.some((step) => step.status === "skipped")).toBeTrue();
    expect(result.failure).toBeUndefined();
    expect(result.ingestionLog.preview).toBeTrue();
  });

  it("fails validation when preview-only execution is requested for non-previewable assets", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      now: () => new Date("2026-03-31T13:40:00.000Z"),
      executionIdFactory: () => "exec-5",
    });

    const asset = new CanonicalDataAsset({
      id: "dataset-no-preview",
      name: "No Preview Asset",
      version: "v1",
      source: { type: "generated", workflowId: "wf-1" },
      location: { accessMethod: "virtual", location: "dataset://no-preview" },
      outputShape: createCanonicalRecordsShape({
        records: [{ recordId: "seed-1", fields: { id: "1" } }],
      }),
      supportsPreview: false,
    });

    const result = await framework.execute({ asset });
    expect(result.ok).toBeFalse();
    expect(result.diagnostics[0]?.code).toBe("preview_unsupported");
    expect(result.failure?.kind).toBe("validation");
    expect(result.ingestionLog.status).toBe("failed");
  });

  it("supports media dataset preview generation through the standard execution flow", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      now: () => new Date("2026-03-31T13:50:00.000Z"),
      executionIdFactory: () => "exec-image-preview",
    });

    const result = await framework.execute({
      asset: createImageAsset(),
      previewOptions: {
        maxItems: 1,
      },
    });

    expect(result.ok).toBeTrue();
    expect(result.preview.kind).toBe("image-metadata-records");
    if (result.preview.kind !== "image-metadata-records") {
      throw new Error("Expected image-metadata-records preview.");
    }
    expect(result.preview.summary.totalCount).toBe(2);
    expect(result.preview.summary.sampleCount).toBe(1);
    expect(result.preview.items[0]?.imageReference).toBe("asset:image:img-1");
    expect(result.validationIssues.length).toBe(0);
  });
});

