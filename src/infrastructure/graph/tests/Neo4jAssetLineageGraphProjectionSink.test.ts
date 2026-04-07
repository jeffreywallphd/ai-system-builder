import { describe, expect, it } from "bun:test";
import { AssetLineageEdge, AssetLineageRelationshipType } from "@domain/assets/AssetLineageEdge";
import { AssetTransformation } from "@domain/assets/AssetTransformation";
import { Neo4jAssetLineageGraphProjectionSink } from "../Neo4jAssetLineageGraphProjectionSink";

class CapturingExecutor {
  public readonly writes: Array<{ readonly cypher: string; readonly params: Readonly<Record<string, unknown>> }> = [];
  public pathExists = false;

  public async runWrite(cypher: string, params: Readonly<Record<string, unknown>>): Promise<void> {
    this.writes.push({ cypher, params });
  }

  public async runRead<TRecord extends Record<string, unknown>>(): Promise<ReadonlyArray<TRecord>> {
    return [{ path_count: this.pathExists ? 1 : 0 } as TRecord];
  }
}

describe("Neo4jAssetLineageGraphProjectionSink", () => {
  it("publishes normalized transformations and lineage edges with Cypher MERGE semantics", async () => {
    const executor = new CapturingExecutor();
    const sink = new Neo4jAssetLineageGraphProjectionSink(executor);

    await sink.publishTransformation(new AssetTransformation({
      transformationId: "tx-1",
      transformationType: "workflow-output",
      status: "success",
      inputVersionIds: ["in:v1"],
      outputVersionIds: ["out:v1"],
    }));
    await sink.publishEdge(new AssetLineageEdge({
      edgeId: "edge-1",
      fromVersionId: "in:v1",
      toVersionId: "out:v1",
      type: AssetLineageRelationshipType.GENERATED_FROM,
      transformationId: "tx-1",
    }));

    expect(executor.writes.length).toBe(2);
    expect(executor.writes[0]?.cypher.includes("MERGE (t:Transformation")).toBeTrue();
    expect(executor.writes[1]?.cypher.includes("MERGE (fromV:Version")).toBeTrue();
  });

  it("can query bounded path existence through the executor", async () => {
    const executor = new CapturingExecutor();
    executor.pathExists = true;
    const sink = new Neo4jAssetLineageGraphProjectionSink(executor);

    await expect(sink.hasVersionPath("a:v1", "c:v1", 4)).resolves.toBeTrue();
  });
});

