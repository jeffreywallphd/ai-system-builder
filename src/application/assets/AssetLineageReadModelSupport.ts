import type { AssetVersion } from "@domain/assets/AssetVersion";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";

export interface CanonicalAssetVersionSummary {
  readonly versionId: string;
  readonly versionLabel?: string;
  readonly parentVersionId?: string;
  readonly createdAt: string;
  readonly upstreamVersionCount: number;
  readonly downstreamVersionCount: number;
  readonly transformationCount: number;
}

export interface CanonicalAssetSummary {
  readonly latestVersionId?: string;
  readonly latestVersionLabel?: string;
  readonly versionCount: number;
  readonly versions: ReadonlyArray<CanonicalAssetVersionSummary>;
}

export interface CanonicalAssetReadRepositories {
  readonly versionRepository: IAssetVersionRepository;
  readonly lineageRepository: IAssetLineageRepository;
  readonly transformationRepository: IAssetTransformationRepository;
}

export async function loadCanonicalAssetSummary(
  assetId: string,
  repositories?: CanonicalAssetReadRepositories,
): Promise<CanonicalAssetSummary | undefined> {
  if (!repositories) {
    return undefined;
  }

  const versions = await repositories.versionRepository.listVersionsByAssetId(assetId);
  if (versions.length === 0) {
    return Object.freeze({
      versionCount: 0,
      versions: Object.freeze([]),
    });
  }

  const summaries = await Promise.all(versions.map(async (version) => toVersionSummary(version, repositories)));
  const sorted = summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return Object.freeze({
    latestVersionId: sorted[0]?.versionId,
    latestVersionLabel: sorted[0]?.versionLabel,
    versionCount: sorted.length,
    versions: Object.freeze(sorted),
  });
}

async function toVersionSummary(
  version: AssetVersion,
  repositories: CanonicalAssetReadRepositories,
): Promise<CanonicalAssetVersionSummary> {
  const [upstreamEdges, downstreamEdges, transformations] = await Promise.all([
    repositories.lineageRepository.listEdgesByVersionId(version.versionId, "upstream"),
    repositories.lineageRepository.listEdgesByVersionId(version.versionId, "downstream"),
    repositories.transformationRepository.listByVersionId(version.versionId),
  ]);

  return Object.freeze({
    versionId: version.versionId,
    versionLabel: version.versionLabel,
    parentVersionId: version.parentVersionId,
    createdAt: version.createdAt.toISOString(),
    upstreamVersionCount: upstreamEdges.length,
    downstreamVersionCount: downstreamEdges.length,
    transformationCount: transformations.length,
  });
}

