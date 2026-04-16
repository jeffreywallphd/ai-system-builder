import { describe, expect, it } from "vitest";

import * as transformContracts from "..";

describe("transform family invariants", () => {
  it("exports only transform-family surfaces from the family barrel", () => {
    expect(Object.keys(transformContracts).sort()).toEqual([
      "TRANSFORM_KINDS",
      "TRANSFORM_STAGES",
      "isTransformKind",
      "isTransformStage",
      "normalizeTransformArtifactReference",
      "normalizeTransformExecutionSummary",
      "normalizeTransformKind",
      "normalizeTransformRecord",
      "normalizeTransformSpecification",
      "normalizeTransformStage",
    ]);
  });
});
