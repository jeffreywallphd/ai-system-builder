import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "../../../domain/system-studio/SystemContextContract";
import {
  createDefaultSystemContextDatasetReferenceResolver,
  SystemContextDatasetResolutionIssueCodes,
} from "../SystemContextDatasetReferenceResolver";

describe("SystemContextDatasetReferenceResolver", () => {
  it("resolves concrete dataset-instance runtime handles for input/output/history references", () => {
    const resolver = createDefaultSystemContextDatasetReferenceResolver();
    const context = createSystemContextContract({
      datasets: [
        {
          referenceId: "active-input",
          instanceId: "instance:input",
          role: "active-input",
          datasetAssetId: "dataset:images-input",
          metadata: { schemaIntentId: "media-input" },
        },
        {
          referenceId: "output",
          instanceId: "instance:output",
          role: "system-owned-output",
          datasetAssetId: "dataset:images-output",
          metadata: { schemaIntentId: "media-output" },
        },
        {
          referenceId: "history",
          instanceId: "instance:history",
          role: "history",
          datasetAssetId: "dataset:images-history",
          metadata: {
            schemaIntentId: "media-history",
            sampleRecords: [{ recordId: "record:1", value: { assetId: "asset:image:1" } }],
          },
        },
      ],
    });

    const resolved = resolver.resolve({ datasets: context.datasets });
    expect(resolved.resolved).toHaveLength(3);
    expect(resolved.issues).toEqual([]);
    expect(resolved.byReferenceId["history"]?.runtimeHandle.kind).toBe("dataset-instance");
  });

  it("surfaces inspectable failures for missing instance and incompatible schema intent", () => {
    const resolver = createDefaultSystemContextDatasetReferenceResolver();
    const context = createSystemContextContract({
      datasets: [
        {
          referenceId: "missing-instance",
          datasetAssetId: "dataset:images-input",
          role: "active-input",
          metadata: { schemaIntentId: "media-input" },
        },
        {
          referenceId: "bad-intent",
          instanceId: "instance:oops",
          datasetAssetId: "dataset:images-output",
          role: "system-owned-output",
          metadata: { schemaIntentId: "tabular" },
        },
      ],
    });

    const result = resolver.resolve({ datasets: context.datasets });
    expect(result.resolved).toHaveLength(0);
    expect(result.unresolved).toHaveLength(2);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      SystemContextDatasetResolutionIssueCodes.unresolvedInstance,
      SystemContextDatasetResolutionIssueCodes.incompatibleSchemaIntent,
    ]));
  });
});
