import { describe, expect, it } from "bun:test";
import { AssetLineageEdge } from "../AssetLineageEdge";

describe("AssetLineageEdge", () => {
  it("accepts typed lineage relationships", () => {
    const edge = new AssetLineageEdge({
      edgeId: "edge-1",
      fromVersionId: "v-source",
      toVersionId: "v-output",
      kind: "generated-from",
    });

    expect(edge.kind).toBe("generated-from");
  });

  it("rejects unsupported kinds and same-node edges", () => {
    expect(
      () =>
        new AssetLineageEdge({
          edgeId: "edge-1",
          fromVersionId: "v1",
          toVersionId: "v2",
          kind: "related-to",
        }),
    ).toThrow("not supported");

    expect(
      () =>
        new AssetLineageEdge({
          edgeId: "edge-1",
          fromVersionId: "v1",
          toVersionId: "v1",
          kind: "derived-from",
        }),
    ).toThrow("distinct");
  });
});
