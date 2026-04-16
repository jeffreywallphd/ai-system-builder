import { describe, expect, it } from "vitest";

import * as artifactContracts from "..";

describe("artifact family invariants", () => {
  it("exports only artifact-family surfaces from the family barrel", () => {
    expect(Object.keys(artifactContracts).sort()).toEqual([
      "ARTIFACT_KINDS",
      "isArtifactKind",
      "normalizeArtifactDescriptor",
      "normalizeArtifactFormatMetadata",
      "normalizeArtifactKind",
      "normalizeArtifactProvenance",
    ]);
  });
});
