import { Asset } from "@domain/assets/Asset";
import { AssetLocation, AssetSourceInfo, AssetTechnicalMetadata } from "@domain/assets/AssetMetadata";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { IModel } from "@domain/models/interfaces/IModel";
import type { DatasetVersion } from "@domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { RegisterAssetUseCase } from "./RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "./CreateAssetVersionUseCase";
import type { ICanonicalAssetIdentityRepository } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function toVersionId(assetId: string, payload: unknown): string {
  return `asset-version:${assetId}:${stableHash(JSON.stringify(payload))}`;
}

export class PublishDurableEntityToAssetSystemUseCase {
  private readonly taxonomyClassifier: CompositionTaxonomyClassifier;

  constructor(
    private readonly registerAssetUseCase: RegisterAssetUseCase,
    private readonly createAssetVersionUseCase: CreateAssetVersionUseCase,
    private readonly canonicalIdentityRepository: ICanonicalAssetIdentityRepository,
    taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
  ) {
    this.taxonomyClassifier = taxonomyClassifier;
  }

  public async publishWorkflowDefinition(workflow: IWorkflow): Promise<{ readonly assetId: string; readonly versionId: string }> {
    const assetId = `workflow-definition:${workflow.id}`;
    const payload = {
      id: workflow.id,
      metadata: workflow.metadata,
      status: workflow.status,
      nodeCount: workflow.nodes.length,
      connectionCount: workflow.connections.length,
      updatedAt: workflow.audit?.updatedAt?.toISOString(),
    };
    const versionId = toVersionId(assetId, payload);

    await this.registerAssetUseCase.execute({
      asset: new Asset({
        id: assetId,
        name: workflow.metadata.name,
        kind: "workflow-definition",
        status: "available",
        source: new AssetSourceInfo({ type: "system", workflowId: workflow.id, provider: "workflow-repository" }),
        location: new AssetLocation({ accessMethod: "virtual", location: `workflow://${workflow.id}`, format: "workflow-json", contentType: "application/vnd.ai-loom.workflow+json" }),
      }),
    });

    await this.createAssetVersionUseCase.execute({
      assetId,
      versionId,
      createdAt: new Date(),
      metadata: payload as Record<string, unknown>,
    });

    await this.canonicalIdentityRepository.upsertIdentity({
      entityType: "workflow-definition",
      entityId: workflow.id,
      assetId,
      latestVersionId: versionId,
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("workflow-definition"),
    });
    return Object.freeze({ assetId, versionId });
  }

  public async publishInstalledModel(model: IModel): Promise<{ readonly assetId: string; readonly versionId: string }> {
    const assetId = `installed-model:${model.id}`;
    const payload = {
      modelId: model.id,
      name: model.name,
      version: model.version,
      status: model.status,
      sourceType: model.source.type,
      location: model.artifact.location,
      sha256: model.artifact.sha256,
    };
    const versionId = toVersionId(assetId, payload);

    await this.registerAssetUseCase.execute({
      asset: new Asset({
        id: assetId,
        name: model.name,
        kind: "model-output",
        status: model.isAvailable() ? "available" : "pending",
        source: new AssetSourceInfo({ type: "system", provider: "installed-model-catalog" }),
        location: new AssetLocation({ accessMethod: model.artifact.accessMethod === "local-file" ? "local-file" : "virtual", location: model.artifact.location, format: model.artifact.format, contentType: model.artifact.contentType }),
        technicalMetadata: new AssetTechnicalMetadata({ sizeBytes: model.artifact.sizeBytes, sha256: model.artifact.sha256 }),
      }),
    });

    await this.createAssetVersionUseCase.execute({
      assetId,
      versionId,
      createdAt: new Date(),
      contentSha256: model.artifact.sha256,
      contentLengthBytes: model.artifact.sizeBytes,
      metadata: payload as Record<string, unknown>,
    });

    await this.canonicalIdentityRepository.upsertIdentity({
      entityType: "installed-model",
      entityId: model.id,
      assetId,
      latestVersionId: versionId,
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("installed-model"),
    });
    await this.canonicalIdentityRepository.upsertIdentity({
      entityType: "base-model",
      entityId: model.id,
      assetId,
      latestVersionId: versionId,
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("base-model"),
    });
    return Object.freeze({ assetId, versionId });
  }

  public async publishDatasetVersion(params: {
    readonly datasetId: string;
    readonly datasetName: string;
    readonly version: DatasetVersion;
    readonly latestExportChecksum?: string;
  }): Promise<{ readonly assetId: string; readonly versionId: string }> {
    const assetId = `dataset-version:${params.datasetId}:${params.version.id}`;
    const payload = {
      datasetId: params.datasetId,
      datasetName: params.datasetName,
      versionId: params.version.id,
      versionNumber: params.version.versionNumber,
      status: params.version.status,
      kind: params.version.kind,
      updatedAt: params.version.updatedAt.toISOString(),
      latestExportChecksum: params.latestExportChecksum,
    };
    const versionId = toVersionId(assetId, payload);

    await this.registerAssetUseCase.execute({
      asset: new Asset({
        id: assetId,
        name: `${params.datasetName} v${params.version.versionNumber}`,
        kind: "dataset",
        status: "available",
        source: new AssetSourceInfo({ type: "system", provider: "dataset-studio" }),
        location: new AssetLocation({ accessMethod: "virtual", location: `dataset://${params.datasetId}/${params.version.id}`, format: "dataset-version", contentType: "application/vnd.ai-loom.dataset-version+json" }),
      }),
    });

    await this.createAssetVersionUseCase.execute({
      assetId,
      versionId,
      createdAt: new Date(),
      contentSha256: params.latestExportChecksum,
      metadata: payload as Record<string, unknown>,
    });

    await this.canonicalIdentityRepository.upsertIdentity({
      entityType: "dataset-version",
      entityId: `${params.datasetId}:${params.version.id}`,
      assetId,
      latestVersionId: versionId,
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("dataset-version"),
    });
    return Object.freeze({ assetId, versionId });
  }
}

