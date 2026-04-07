import type { INeo4jCypherExecutor } from "./Neo4jAssetLineageGraphProjectionSink";

export class NoopNeo4jCypherExecutor implements INeo4jCypherExecutor {
  public readonly writes: Array<{ readonly cypher: string; readonly params: Readonly<Record<string, unknown>> }> = [];

  public async runWrite(cypher: string, params: Readonly<Record<string, unknown>>): Promise<void> {
    this.writes.push(Object.freeze({ cypher, params }));
  }

  public async runRead<TRecord extends Record<string, unknown>>(_cypher: string, _params: Readonly<Record<string, unknown>>): Promise<ReadonlyArray<TRecord>> {
    return Object.freeze([]);
  }
}
