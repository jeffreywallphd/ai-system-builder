import { describe, expect, it } from "vitest";

import * as datasetContracts from "..";

describe("dataset family invariants", () => {
  it("exports only dataset-family surfaces from the family barrel", () => {
    expect(Object.keys(datasetContracts).sort()).toEqual([
      "normalizeDatasetDescriptor",
      "normalizeDatasetMaterializationDescriptor",
      "normalizeDatasetSchemaSummary",
    ]);
  });
});
