import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";

export interface IGraphProjectionTraversalReader {
  hasVersionPath(fromVersionId: string, toVersionId: string, maxDepth?: number): boolean;
  listOutgoingVersionIds(versionId: string): ReadonlyArray<string>;
  listIncomingVersionIds(versionId: string): ReadonlyArray<string>;
}

export class VerifyAssetGraphProjectionUseCase {
  constructor(
    private readonly queryRepository: IAssetSystemQueryRepository,
    private readonly traversalReader: IGraphProjectionTraversalReader,
  ) {}

  public async execute(params: {
    readonly assetId: string;
    readonly fromVersionId?: string;
    readonly toVersionId?: string;
    readonly expectedEdgeCountAtLeast?: number;
  }): Promise<{
    readonly assetId: string;
    readonly matched: boolean;
    readonly checks: ReadonlyArray<{
      readonly code: string;
      readonly matched: boolean;
      readonly message: string;
    }>;
  }> {
    const edges = await this.queryRepository.listLineageEdgesByAssetId(params.assetId);
    const checks: Array<{ code: string; matched: boolean; message: string; }> = [];
    const minEdgeCount = params.expectedEdgeCountAtLeast ?? 1;
    checks.push({
      code: "EDGE_COUNT",
      matched: edges.length >= minEdgeCount,
      message: `Projected edge count=${edges.length}; expected >= ${minEdgeCount}.`,
    });

    if (params.fromVersionId && params.toVersionId) {
      const pathMatched = this.traversalReader.hasVersionPath(params.fromVersionId, params.toVersionId, 8);
      checks.push({
        code: "PATH_EXISTS",
        matched: pathMatched,
        message: pathMatched
          ? `Path '${params.fromVersionId}' -> '${params.toVersionId}' is present in projection.`
          : `Path '${params.fromVersionId}' -> '${params.toVersionId}' is not present in projection.`,
      });
      if (pathMatched) {
        checks.push({
          code: "OUTGOING_NON_EMPTY",
          matched: this.traversalReader.listOutgoingVersionIds(params.fromVersionId).length > 0,
          message: `Outgoing adjacency from '${params.fromVersionId}' was traversable.`,
        });
        checks.push({
          code: "INCOMING_NON_EMPTY",
          matched: this.traversalReader.listIncomingVersionIds(params.toVersionId).length > 0,
          message: `Incoming adjacency to '${params.toVersionId}' was traversable.`,
        });
      }
    }

    return Object.freeze({
      assetId: params.assetId,
      matched: checks.every((check) => check.matched),
      checks: Object.freeze(checks.map((entry) => Object.freeze(entry))),
    });
  }
}
