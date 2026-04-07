import { describe, expect, it } from "bun:test";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import { InMemoryAssetLineageGraphProjectionSink } from "../../../infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink";
import { VerifyAssetGraphProjectionUseCase } from "../VerifyAssetGraphProjectionUseCase";

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
    expect(sink.hasVersionPath("in:v1", "out:v1")).toBeTrue();
    expect(sink.listOutgoingVersionIds("in:v1")).toContain("out:v1");
    expect(sink.listIncomingVersionIds("out:v1")).toContain("in:v1");
  });

  it("verifies projected path/edge expectations for a canonical scope", async () => {
    const sink = new InMemoryAssetLineageGraphProjectionSink();
    await sink.publishEdge(new AssetLineageEdge({
      edgeId: "e-verify",
      fromVersionId: "left:v1",
      toVersionId: "right:v1",
      type: AssetLineageRelationshipType.DERIVED_FROM,
    }));
    const verification = await new VerifyAssetGraphProjectionUseCase(
      {
        listLineageEdgesByAssetId: async () => [new AssetLineageEdge({
          edgeId: "e-verify",
          fromVersionId: "left:v1",
          toVersionId: "right:v1",
          type: AssetLineageRelationshipType.DERIVED_FROM,
        })],
        listAdjacentVersionIds: async (versionId: string, direction: "upstream" | "downstream") =>
          direction === "upstream"
            ? (versionId === "right:v1" ? ["left:v1"] : [])
            : (versionId === "left:v1" ? ["right:v1"] : []),
      } as any,
      sink,
    ).execute({
      assetId: "asset-x",
      fromVersionId: "left:v1",
      toVersionId: "right:v1",
      expectedEdgeCountAtLeast: 1,
      versionIdsInScope: ["left:v1", "right:v1"],
    });

    expect(verification.matched).toBeTrue();
    expect(verification.trust.state).toBe("trusted");
    expect(verification.projectionSummary.scopedVersionCount).toBe(2);
    expect(verification.checks.some((check) => check.code === "PATH_EXISTS" && check.matched)).toBeTrue();
  });

  it("reports scoped edge-parity mismatch details when projection diverges", async () => {
    const sink = new InMemoryAssetLineageGraphProjectionSink();
    await sink.publishEdge(new AssetLineageEdge({
      edgeId: "e-extra",
      fromVersionId: "left:v1",
      toVersionId: "unexpected:v1",
      type: AssetLineageRelationshipType.DERIVED_FROM,
    }));
    const verification = await new VerifyAssetGraphProjectionUseCase(
      {
        listLineageEdgesByAssetId: async () => [new AssetLineageEdge({
          edgeId: "e-repo",
          fromVersionId: "left:v1",
          toVersionId: "right:v1",
          type: AssetLineageRelationshipType.DERIVED_FROM,
        })],
        listAdjacentVersionIds: async (versionId: string, direction: "upstream" | "downstream") =>
          direction === "upstream"
            ? (versionId === "right:v1" ? ["left:v1"] : [])
            : (versionId === "left:v1" ? ["right:v1"] : []),
      } as any,
      sink,
    ).execute({
      assetId: "asset-y",
      versionIdsInScope: ["left:v1"],
      strictEdgeParityInScope: true,
    });

    expect(verification.matched).toBeFalse();
    expect(verification.trust.state).toBe("mismatch-detected");
    expect(verification.mismatches[0]?.versionId).toBe("left:v1");
    expect(verification.checks.some((check) => check.code.startsWith("SCOPE_EDGE_PARITY_DETAIL:left:v1") && !check.matched)).toBeTrue();
  });
});
