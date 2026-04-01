import { describe, expect, it } from "bun:test";
import { createCanonicalRecordsShape } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import {
  DataStudioValidationSections,
  hasErrorIssues,
  toDataConverterDiagnostics,
  validateDataAssetConfigValues,
  validateCanonicalDataShape,
  validateDataAssetExecutionRequest,
  validateDataPreviewModel,
} from "../DataStudioValidation";
import { DataAssetConfigFieldKinds, createDataAssetConfigSchema } from "../DataAssetConfiguration";

describe("DataStudioValidation", () => {
  it("validates canonical-shape contract boundaries", () => {
    const invalidShape = {
      kind: "records",
      metadata: { schemaVersion: "1.0.0" },
      records: [{ recordId: "", fields: { id: "1" } }],
    } as const;

    const issues = validateCanonicalDataShape(invalidShape as never);
    expect(issues.some((issue) => issue.section === DataStudioValidationSections.canonicalShape)).toBeTrue();
    expect(hasErrorIssues(issues)).toBeTrue();
  });

  it("validates execution request boundaries and data-asset config", () => {
    const asset = new CanonicalDataAsset({
      id: "dataset-1",
      name: "Dataset",
      source: { type: "generated", workflowId: "wf-1" },
      location: { accessMethod: "virtual", location: "dataset://1" },
      outputShape: createCanonicalRecordsShape({
        records: [{ recordId: "r1", fields: { id: "1" } }],
      }),
      composableInputShapeKinds: Object.freeze([]),
    });

    const issues = validateDataAssetExecutionRequest({
      asset,
      previewOptions: { maxItems: 0 },
      input: {
        kind: "source-reference",
        source: {
          kind: "local-file",
          path: " ",
        },
      },
    });

    expect(issues.some((issue) => issue.code === "execution-preview-max-items-invalid")).toBeTrue();
    expect(issues.some((issue) => issue.code === "source-local-file-path-missing")).toBeTrue();
    expect(issues.some((issue) => issue.code === "data-asset-composable-kinds-empty")).toBeTrue();
  });

  it("validates preview-model boundaries and maps issues to diagnostics", () => {
    const issues = validateDataPreviewModel({
      kind: "error",
      message: " ",
      summary: { totalCount: 1, sampleCount: 2, truncated: false },
      metadata: { schemaVersion: "1.0.0", lineageCount: 0 },
      diagnostics: { infoCount: 0, warningCount: 0, errorCount: 1, diagnostics: [] },
    });

    expect(issues.some((issue) => issue.code === "preview-summary-sample-count-invalid")).toBeTrue();
    expect(issues.some((issue) => issue.code === "preview-error-message-missing")).toBeTrue();

    const diagnostics = toDataConverterDiagnostics(issues);
    expect(diagnostics.length).toBe(issues.length);
    expect(diagnostics[0]?.details?.section).toBe(DataStudioValidationSections.previewModel);
  });

  it("validates image preview window metadata", () => {
    const issues = validateDataPreviewModel({
      kind: "image-metadata-records",
      summary: { totalCount: 10, sampleCount: 1, truncated: true },
      metadata: { schemaVersion: "1.0.0", lineageCount: 0 },
      diagnostics: { infoCount: 0, warningCount: 0, errorCount: 0, diagnostics: [] },
      items: [{
        itemId: "img-1",
        selectionId: "img-1",
        format: "png",
        metadataSummary: {},
        tags: [],
        annotations: {},
        derived: {},
        issues: [],
      }],
      window: {
        offset: -1,
        limit: 5,
        returned: 2,
        hasPreviousWindow: false,
        hasNextWindow: true,
      },
    });

    expect(issues.some((issue) => issue.code === "preview-image-window-returned-count-mismatch")).toBeTrue();
    expect(issues.some((issue) => issue.code === "preview-image-window-offset-invalid")).toBeTrue();
  });

  it("validates schema-driven data-asset config values with field-level paths", () => {
    const schema = createDataAssetConfigSchema({
      schemaId: "dataset-preview.schema",
      fields: [
        {
          key: "formatHint",
          label: "Input format",
          kind: DataAssetConfigFieldKinds.select,
          required: true,
          options: [
            { value: "json", label: "JSON" },
            { value: "csv", label: "CSV" },
          ],
        },
        {
          key: "previewMaxItems",
          label: "Preview max items",
          kind: DataAssetConfigFieldKinds.number,
          min: 1,
          max: 20,
          required: true,
        },
      ],
    });

    const issues = validateDataAssetConfigValues({
      formatHint: "yaml",
      previewMaxItems: 0,
      unknownField: true,
    }, schema);

    expect(issues.some((issue) => issue.code === "data-asset-config-select-option-invalid")).toBeTrue();
    expect(issues.some((issue) => issue.code === "data-asset-config-number-min-violated")).toBeTrue();
    expect(issues.some((issue) => issue.code === "data-asset-config-key-unsupported")).toBeTrue();
    expect(issues.some((issue) => issue.path === "config.values.formatHint")).toBeTrue();
  });
});
