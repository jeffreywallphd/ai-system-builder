import { describe, expect, it } from "vitest";

import {
  ARTIFACT_KINDS,
  normalizeArtifactDescriptor,
  normalizeArtifactKind,
} from ".";

describe("artifact contracts", () => {
  it("normalizes and constrains artifact kind vocabulary", () => {
    expect(ARTIFACT_KINDS).toEqual(["raw-staged", "derived", "materialized"]);
    expect(normalizeArtifactKind(" Derived ")).toBe("derived");
  });

  it("normalizes artifact descriptors with format/provenance metadata", () => {
    const descriptor = normalizeArtifactDescriptor({
      key: " staging/raw/customer-data.csv ",
      kind: " raw-staged ",
      name: " customers.csv ",
      format: {
        mediaType: " text/csv ",
      },
      provenance: {
        sourceKind: " Upload ",
        sourceId: " intake-44 ",
        parentArtifactKeys: [" staging/raw/import-1 "],
      },
    });

    expect(descriptor).toEqual({
      key: "staging/raw/customer-data.csv",
      kind: "raw-staged",
      name: "customers.csv",
      format: {
        mediaType: "text/csv",
        encoding: undefined,
        extension: undefined,
      },
      provenance: {
        sourceKind: "upload",
        sourceId: "intake-44",
        parentArtifactKeys: ["staging/raw/import-1"],
        transformId: undefined,
      },
    });
  });
});
