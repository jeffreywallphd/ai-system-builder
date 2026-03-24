import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetSystemQueryRepository, CanonicalAssetQueryCriteria } from "../ports/interfaces/IAssetSystemQueryRepository";

export class LoadCanonicalAssetSummaryUseCase {
  constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async execute(assetId: string): Promise<{
    readonly assetId: string;
    readonly name: string;
    readonly kind: string;
    readonly status: string;
    readonly latestVersionId?: string;
    readonly versionCount: number;
  } | undefined> {
    const asset = await this.assetRepository.getById(assetId);
    if (!asset) return undefined;
    const versions = await this.versionRepository.listVersionsByAssetId(assetId);
    const latest = this.queryRepository
      ? await this.queryRepository.getLatestVersionForAsset(assetId)
      : versions[0];

    return Object.freeze({
      assetId: asset.id,
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      latestVersionId: latest?.versionId,
      versionCount: versions.length,
    });
  }
}

export class ListCanonicalAssetsUseCase {
  constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async execute(criteria?: CanonicalAssetQueryCriteria) {
    if (this.queryRepository) {
      return this.queryRepository.listAssetsByCriteria(criteria);
    }

    const assets = await this.assetRepository.list();
    return assets.filter((asset) => {
      if (criteria?.kinds?.length && !criteria.kinds.includes(asset.kind)) return false;
      if (criteria?.sourceTypes?.length && !criteria.sourceTypes.includes(asset.source.type)) return false;
      if (criteria?.statuses?.length && !criteria.statuses.includes(asset.status)) return false;
      return true;
    }).slice(0, criteria?.limit && criteria.limit > 0 ? criteria.limit : undefined);
  }
}

export class ListCanonicalAssetVersionsUseCase {
  constructor(private readonly versionRepository: IAssetVersionRepository) {}
  public async execute(assetId: string) {
    return this.versionRepository.listVersionsByAssetId(assetId);
  }
}

export class GetCanonicalLatestVersionUseCase {
  constructor(
    private readonly versionRepository: IAssetVersionRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async execute(assetId: string) {
    if (this.queryRepository) {
      return this.queryRepository.getLatestVersionForAsset(assetId);
    }
    const versions = await this.versionRepository.listVersionsByAssetId(assetId);
    return versions[0];
  }
}

export class LoadCanonicalTransformationHistoryUseCase {
  constructor(
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async forAsset(assetId: string) {
    if (!this.queryRepository) {
      return Object.freeze([]);
    }
    return this.queryRepository.listTransformationsByAssetId(assetId);
  }

  public async forVersion(versionId: string) {
    return this.transformationRepository.listByVersionId(versionId);
  }
}

export class GetCanonicalVersionDependencyUseCase {
  constructor(
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async execute(versionId: string) {
    const [dependencies, dependents] = this.queryRepository
      ? await Promise.all([
        this.queryRepository.listAdjacentVersionIds(versionId, "upstream"),
        this.queryRepository.listAdjacentVersionIds(versionId, "downstream"),
      ])
      : await Promise.all([
        this.lineageRepository.listEdgesByVersionId(versionId, "upstream").then((edges) => edges.map((edge) => edge.fromVersionId)),
        this.lineageRepository.listEdgesByVersionId(versionId, "downstream").then((edges) => edges.map((edge) => edge.toVersionId)),
      ]);

    return Object.freeze({
      versionId,
      dependencyVersionIds: Object.freeze([...new Set(dependencies)]),
      dependentVersionIds: Object.freeze([...new Set(dependents)]),
    });
  }
}
