import { describe, expect, it } from "vitest";

import * as lineageContracts from "..";

describe("lineage family invariants", () => {
  it("exports only lineage-family surfaces from the family barrel", () => {
    expect(Object.keys(lineageContracts).sort()).toEqual([
      "LINEAGE_EDGE_KINDS",
      "LINEAGE_NODE_KINDS",
      "isLineageEdgeKind",
      "isLineageNodeKind",
      "normalizeLineageEdgeKind",
      "normalizeLineageEdgeRecord",
      "normalizeLineageNodeKind",
      "normalizeLineageRecord",
      "normalizeLineageReference",
    ]);
  });
});
