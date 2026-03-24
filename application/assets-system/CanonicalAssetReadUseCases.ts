import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetSystemQueryRepository, CanonicalAssetQueryCriteria } from "../ports/interfaces/IAssetSystemQueryRepository";
import type { AssetVersion } from "../../domain/assets/AssetVersion";

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

export class LoadCanonicalAssetDetailUseCase {
  constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async execute(assetId: string): Promise<{
    readonly assetId: string;
    readonly name: string;
    readonly kind: string;
    readonly status: string;
    readonly latestVersion?: AssetVersion;
    readonly versionCount: number;
    readonly transformationCount: number;
    readonly lineageEdgeCount: number;
  } | undefined> {
    const asset = await this.assetRepository.getById(assetId.trim());
    if (!asset) {
      return undefined;
    }

    const [versions, latestVersion, transformations, edges] = await Promise.all([
      this.queryRepository ? this.queryRepository.listVersionChainByAssetId(asset.id) : this.versionRepository.listVersionsByAssetId(asset.id),
      this.queryRepository ? this.queryRepository.getLatestVersionForAsset(asset.id) : this.versionRepository.listVersionsByAssetId(asset.id).then((list) => list[0]),
      this.queryRepository ? this.queryRepository.listTransformationsByAssetId(asset.id) : Promise.resolve([]),
      this.queryRepository ? this.queryRepository.listLineageEdgesByAssetId(asset.id) : Promise.resolve([]),
    ]);

    return Object.freeze({
      assetId: asset.id,
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      latestVersion,
      versionCount: versions.length,
      transformationCount: transformations.length,
      lineageEdgeCount: edges.length,
    });
  }
}

export class GetCanonicalProvenanceSummaryUseCase {
  constructor(
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly queryRepository?: IAssetSystemQueryRepository,
  ) {}

  public async execute(versionId: string): Promise<{
    readonly versionId: string;
    readonly directUpstreamVersionIds: ReadonlyArray<string>;
    readonly directDownstreamVersionIds: ReadonlyArray<string>;
    readonly producingTransformationIds: ReadonlyArray<string>;
    readonly consumingTransformationIds: ReadonlyArray<string>;
  }> {
    const [upstream, downstream, transformations] = this.queryRepository
      ? await Promise.all([
        this.queryRepository.listAdjacentVersionIds(versionId, "upstream"),
        this.queryRepository.listAdjacentVersionIds(versionId, "downstream"),
        this.transformationRepository.listByVersionId(versionId),
      ])
      : await Promise.all([
        this.lineageRepository.listEdgesByVersionId(versionId, "upstream").then((items) => items.map((edge) => edge.fromVersionId)),
        this.lineageRepository.listEdgesByVersionId(versionId, "downstream").then((items) => items.map((edge) => edge.toVersionId)),
        this.transformationRepository.listByVersionId(versionId),
      ]);

    return Object.freeze({
      versionId,
      directUpstreamVersionIds: Object.freeze([...new Set(upstream)]),
      directDownstreamVersionIds: Object.freeze([...new Set(downstream)]),
      producingTransformationIds: Object.freeze(transformations.filter((entry) => entry.outputVersionIds.includes(versionId)).map((entry) => entry.transformationId)),
      consumingTransformationIds: Object.freeze(transformations.filter((entry) => entry.inputVersionIds.includes(versionId)).map((entry) => entry.transformationId)),
    });
  }
}

export class ExplainCanonicalVersionExistenceUseCase {
  constructor(
    private readonly provenanceSummaryUseCase: GetCanonicalProvenanceSummaryUseCase,
    private readonly transformationRepository: IAssetTransformationRepository,
  ) {}

  public async execute(versionId: string): Promise<{
    readonly versionId: string;
    readonly explanation: string;
    readonly evidence: ReadonlyArray<string>;
  }> {
    const provenance = await this.provenanceSummaryUseCase.execute(versionId);
    const producingTransformations = await Promise.all(
      provenance.producingTransformationIds.map((transformationId) => this.transformationRepository.getById(transformationId)),
    );
    const producingKinds = producingTransformations
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .map((entry) => entry.kind);

    const explanation = provenance.producingTransformationIds.length > 0
      ? `Version '${versionId}' was produced by ${provenance.producingTransformationIds.length} recorded transformation(s).`
      : provenance.directUpstreamVersionIds.length > 0
        ? `Version '${versionId}' has upstream lineage but no explicit producing transformation record.`
        : `Version '${versionId}' has no direct producing transformation or upstream lineage in canonical records.`;

    return Object.freeze({
      versionId,
      explanation,
      evidence: Object.freeze([
        ...provenance.producingTransformationIds.map((id) => `produced-by:${id}`),
        ...producingKinds.map((kind) => `transformation-kind:${kind}`),
        ...provenance.directUpstreamVersionIds.map((id) => `upstream:${id}`),
      ]),
    });
  }
}
