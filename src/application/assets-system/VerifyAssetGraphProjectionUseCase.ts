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
    readonly trust: {
      readonly state: "trusted" | "mismatch-detected";
      readonly explanation: string;
      readonly recommendedActions: ReadonlyArray<string>;
    };
    readonly projectionSummary: {
      readonly edgeCount: number;
      readonly scopedVersionCount: number;
    };
    readonly mismatches: ReadonlyArray<{
      readonly versionId: string;
      readonly missingUpstreamVersionIds: ReadonlyArray<string>;
      readonly unexpectedUpstreamVersionIds: ReadonlyArray<string>;
      readonly missingDownstreamVersionIds: ReadonlyArray<string>;
      readonly unexpectedDownstreamVersionIds: ReadonlyArray<string>;
    }>;
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
    const mismatches: Array<{
      versionId: string;
      missingUpstreamVersionIds: ReadonlyArray<string>;
      unexpectedUpstreamVersionIds: ReadonlyArray<string>;
      missingDownstreamVersionIds: ReadonlyArray<string>;
      unexpectedDownstreamVersionIds: ReadonlyArray<string>;
    }> = [];
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
      const missingUpstream = [...upstreamFromRepo].filter((id) => !upstreamFromProjection.has(id));
      const unexpectedUpstream = [...upstreamFromProjection].filter((id) => !upstreamFromRepo.has(id));
      const missingDownstream = [...downstreamFromRepo].filter((id) => !downstreamFromProjection.has(id));
      const unexpectedDownstream = [...downstreamFromProjection].filter((id) => !downstreamFromRepo.has(id));
      if (missingUpstream.length > 0 || unexpectedUpstream.length > 0 || missingDownstream.length > 0 || unexpectedDownstream.length > 0) {
        mismatches.push({
          versionId,
          missingUpstreamVersionIds: Object.freeze(missingUpstream),
          unexpectedUpstreamVersionIds: Object.freeze(unexpectedUpstream),
          missingDownstreamVersionIds: Object.freeze(missingDownstream),
          unexpectedDownstreamVersionIds: Object.freeze(unexpectedDownstream),
        });
      }
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
        checks.push({
          code: `SCOPE_EDGE_PARITY_DETAIL:${versionId}`,
          matched: missingUpstream.length === 0 && unexpectedUpstream.length === 0 && missingDownstream.length === 0 && unexpectedDownstream.length === 0,
          message: missingUpstream.length === 0 && unexpectedUpstream.length === 0 && missingDownstream.length === 0 && unexpectedDownstream.length === 0
            ? `Scoped edge parity for '${versionId}' is exact.`
            : `Scoped edge parity mismatch for '${versionId}' missingUpstream=[${missingUpstream.join(", ")}] unexpectedUpstream=[${unexpectedUpstream.join(", ")}] missingDownstream=[${missingDownstream.join(", ")}] unexpectedDownstream=[${unexpectedDownstream.join(", ")}].`,
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

    const matched = checks.every((check) => check.matched);
    return Object.freeze({
      assetId: params.assetId,
      matched,
      trust: Object.freeze({
        state: matched ? "trusted" : "mismatch-detected",
        explanation: matched
          ? "Projection scope matches canonical repository adjacency and edge expectations."
          : `Projection mismatches were detected for ${mismatches.length} scoped version(s).`,
        recommendedActions: Object.freeze(matched
          ? ["No projection repair is currently required."]
          : [
            "Replay graph projection for mismatched scoped versions.",
            "Re-run projection verification for the same scope after replay.",
          ]),
      }),
      projectionSummary: Object.freeze({
        edgeCount: edges.length,
        scopedVersionCount: scopedVersionIds.length,
      }),
      mismatches: Object.freeze(mismatches.map((entry) => Object.freeze(entry))),
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
