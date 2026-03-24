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
    readonly versionIdsInScope?: ReadonlyArray<string>;
    readonly fromVersionId?: string;
    readonly toVersionId?: string;
    readonly expectedEdgeCountAtLeast?: number;
    readonly strictEdgeParityInScope?: boolean;
  }): Promise<{
    readonly assetId: string;
    readonly matched: boolean;
    readonly projectionSummary: {
      readonly edgeCount: number;
      readonly scopedVersionCount: number;
    };
    readonly checks: ReadonlyArray<{
      readonly code: string;
      readonly matched: boolean;
      readonly message: string;
    }>;
  }> {
    const edges = await this.queryRepository.listLineageEdgesByAssetId(params.assetId);
    const checks: Array<{ code: string; matched: boolean; message: string; }> = [];
    const minEdgeCount = params.expectedEdgeCountAtLeast ?? 1;
    const scopedVersionIds = [...new Set((params.versionIdsInScope ?? []).map((entry) => entry.trim()).filter(Boolean))];
    const strictEdgeParityInScope = params.strictEdgeParityInScope ?? true;
    checks.push({
      code: "EDGE_COUNT",
      matched: edges.length >= minEdgeCount,
      message: `Projected edge count=${edges.length}; expected >= ${minEdgeCount}.`,
    });
    for (const versionId of scopedVersionIds) {
      const upstreamFromRepo = new Set(await this.queryRepository.listAdjacentVersionIds(versionId, "upstream"));
      const downstreamFromRepo = new Set(await this.queryRepository.listAdjacentVersionIds(versionId, "downstream"));
      const upstreamFromProjection = new Set(this.traversalReader.listIncomingVersionIds(versionId));
      const downstreamFromProjection = new Set(this.traversalReader.listOutgoingVersionIds(versionId));
      checks.push({
        code: `SCOPE_ADJACENCY_UPSTREAM:${versionId}`,
        matched: this.isSetEqual(upstreamFromRepo, upstreamFromProjection),
        message: `Upstream adjacency parity for '${versionId}' repository=${upstreamFromRepo.size} projection=${upstreamFromProjection.size}.`,
      });
      checks.push({
        code: `SCOPE_ADJACENCY_DOWNSTREAM:${versionId}`,
        matched: this.isSetEqual(downstreamFromRepo, downstreamFromProjection),
        message: `Downstream adjacency parity for '${versionId}' repository=${downstreamFromRepo.size} projection=${downstreamFromProjection.size}.`,
      });

      if (strictEdgeParityInScope) {
        const missingDownstream = [...downstreamFromRepo].filter((id) => !downstreamFromProjection.has(id));
        const unexpectedDownstream = [...downstreamFromProjection].filter((id) => !downstreamFromRepo.has(id));
        checks.push({
          code: `SCOPE_EDGE_PARITY_DETAIL:${versionId}`,
          matched: missingDownstream.length === 0 && unexpectedDownstream.length === 0,
          message: missingDownstream.length === 0 && unexpectedDownstream.length === 0
            ? `Scoped edge parity for '${versionId}' is exact.`
            : `Scoped edge parity mismatch for '${versionId}' missing=[${missingDownstream.join(", ")}] unexpected=[${unexpectedDownstream.join(", ")}].`,
        });
      }
    }

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
      projectionSummary: Object.freeze({
        edgeCount: edges.length,
        scopedVersionCount: scopedVersionIds.length,
      }),
      checks: Object.freeze(checks.map((entry) => Object.freeze(entry))),
    });
  }

  private isSetEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
    if (left.size !== right.size) {
      return false;
    }
    for (const value of left) {
      if (!right.has(value)) {
        return false;
      }
    }
    return true;
  }
}
