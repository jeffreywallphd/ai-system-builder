import { describe, expect, it } from "bun:test";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import { InMemoryAssetLineageGraphProjectionSink } from "../../../infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink";

describe("InMemoryAssetLineageGraphProjectionSink", () => {
  it("captures transformation and edge projections for graph-ready publication", async () => {
    const sink = new InMemoryAssetLineageGraphProjectionSink();

    const transformation = new AssetTransformation({
      transformationId: "tx-1",
      transformationType: "workflow-output",
      status: "success",
      inputVersionIds: ["in:v1"],
      outputVersionIds: ["out:v1"],
    });
    const edge = new AssetLineageEdge({
      edgeId: "e-1",
      fromVersionId: "in:v1",
      toVersionId: "out:v1",
      type: AssetLineageRelationshipType.GENERATED_FROM,
      transformationId: "tx-1",
    });

    await sink.publishTransformation(transformation);
    await sink.publishEdge(edge);

    expect(sink.publishedTransformations).toHaveLength(1);
    expect(sink.publishedTransformations[0]?.transformationId).toBe("tx-1");
    expect(sink.publishedEdges).toHaveLength(1);
    expect(sink.publishedEdges[0]?.edgeId).toBe("e-1");
  });
});
