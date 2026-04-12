import type { IAssetLineageGraphProjectionSink } from "@application/ports/interfaces/IAssetLineageGraphProjectionSink";
import type { AssetLineageEdge } from "@domain/assets/AssetLineageEdge";
import type { AssetTransformation } from "@domain/assets/AssetTransformation";

export interface INeo4jCypherExecutor {
  runWrite(cypher: string, params: Readonly<Record<string, unknown>>): Promise<void>;
  runRead<TRecord extends Record<string, unknown>>(cypher: string, params: Readonly<Record<string, unknown>>): Promise<ReadonlyArray<TRecord>>;
}

export class Neo4jAssetLineageGraphProjectionSink implements IAssetLineageGraphProjectionSink {
  constructor(private readonly executor: INeo4jCypherExecutor) {}

  public async publishTransformation(transformation: AssetTransformation): Promise<void> {
    await this.executor.runWrite(`
      MERGE (t:Transformation {id: $transformationId})
      SET t.kind = $kind,
          t.status = $status,
          t.createdAt = $createdAt,
          t.workflowId = $workflowId,
          t.nodeId = $nodeId,
          t.executionId = $executionId,
          t.runtime = $runtime,
          t.provider = $provider
      WITH t
      UNWIND $inputVersionIds AS inputVersionId
      MERGE (inV:Version {id: inputVersionId})
      MERGE (t)-[:CONSUMES]->(inV)
      WITH t
      UNWIND $outputVersionIds AS outputVersionId
      MERGE (outV:Version {id: outputVersionId})
      MERGE (t)-[:PRODUCES]->(outV)
    `, {
      transformationId: transformation.transformationId,
      kind: transformation.kind,
      status: transformation.status,
      createdAt: transformation.createdAt.toISOString(),
      workflowId: transformation.workflowId,
      nodeId: transformation.nodeId,
      executionId: transformation.executionId,
      runtime: transformation.runtime,
      provider: transformation.provider,
      inputVersionIds: transformation.inputVersionIds,
      outputVersionIds: transformation.outputVersionIds,
    });
  }

  public async publishEdge(edge: AssetLineageEdge): Promise<void> {
    await this.executor.runWrite(`
      MERGE (fromV:Version {id: $fromVersionId})
      MERGE (toV:Version {id: $toVersionId})
      MERGE (fromV)-[r:LINEAGE_EDGE {id: $edgeId}]->(toV)
      SET r.kind = $kind,
          r.createdAt = $createdAt,
          r.transformationId = $transformationId
    `, {
      edgeId: edge.edgeId,
      kind: edge.kind,
      fromVersionId: edge.fromVersionId,
      toVersionId: edge.toVersionId,
      transformationId: edge.transformationId,
      createdAt: edge.createdAt.toISOString(),
    });
  }

  public async hasVersionPath(fromVersionId: string, toVersionId: string, maxDepth = 6): Promise<boolean> {
    const rows = await this.executor.runRead<{ path_count: number }>(`
      MATCH (fromV:Version {id: $fromVersionId}), (toV:Version {id: $toVersionId})
      OPTIONAL MATCH p = (fromV)-[:LINEAGE_EDGE*1..${Math.max(1, Math.min(maxDepth, 10))}]->(toV)
      RETURN CASE WHEN p IS NULL THEN 0 ELSE 1 END AS path_count
      LIMIT 1
    `, {
      fromVersionId,
      toVersionId,
    });

    return (rows[0]?.path_count ?? 0) > 0;
  }
}

