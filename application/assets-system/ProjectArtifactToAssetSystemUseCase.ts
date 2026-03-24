import { Asset } from "../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo, AssetTechnicalMetadata } from "../../domain/assets/AssetMetadata";
import type { AssetKind } from "../../domain/assets/interfaces/IAsset";
import { RegisterAssetUseCase } from "./RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "./CreateAssetVersionUseCase";
import { RecordAssetTransformationUseCase } from "./RecordAssetTransformationUseCase";
import { LinkAssetLineageUseCase } from "./LinkAssetLineageUseCase";

function resolveAssetKindFromContentType(contentType?: string): AssetKind {
  if (!contentType) {
    return "generic";
  }

  if (contentType.includes("json")) {
    return "json";
  }

  if (contentType.includes("image")) {
    return "image";
  }

  if (contentType.includes("text")) {
    return "text";
  }

  return "binary";
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type ProjectableArtifact =
  | {
      readonly projectionKind: "uploaded-file";
      readonly assetId: string;
      readonly name: string;
      readonly location: string;
      readonly contentType?: string;
      readonly format?: string;
      readonly checksum?: string;
      readonly byteLength?: number;
      readonly uploadedBy?: string;
    }
  | {
      readonly projectionKind: "dataset-export";
      readonly assetId: string;
      readonly name: string;
      readonly datasetId: string;
      readonly datasetVersionId: string;
      readonly location: string;
      readonly format?: string;
      readonly contentType?: string;
      readonly checksum?: string;
      readonly byteLength?: number;
      readonly sourceVersionIds?: ReadonlyArray<string>;
    }
  | {
      readonly projectionKind: "workflow-output";
      readonly assetId: string;
      readonly name: string;
      readonly executionId: string;
      readonly workflowId?: string;
      readonly nodeId?: string;
      readonly location: string;
      readonly contentType?: string;
      readonly format?: string;
      readonly checksum?: string;
      readonly byteLength?: number;
      readonly inputVersionIds?: ReadonlyArray<string>;
    };

export class ProjectArtifactToAssetSystemUseCase {
  constructor(
    private readonly registerAssetUseCase: RegisterAssetUseCase,
    private readonly createAssetVersionUseCase: CreateAssetVersionUseCase,
    private readonly recordTransformationUseCase: RecordAssetTransformationUseCase,
    private readonly linkLineageUseCase: LinkAssetLineageUseCase,
  ) {}

  public async execute(artifact: ProjectableArtifact): Promise<{ readonly assetId: string; readonly versionId: string; readonly transformationId?: string }> {
    const now = new Date();
    const versionId = randomId("asset-version");

    const asset = new Asset({
      id: artifact.assetId,
      name: artifact.name,
      kind: artifact.projectionKind === "dataset-export"
        ? "dataset"
        : resolveAssetKindFromContentType(artifact.contentType),
      status: "available",
      source: new AssetSourceInfo({
        type: artifact.projectionKind === "uploaded-file" ? "uploaded" : "generated",
        workflowId: artifact.projectionKind === "workflow-output" ? artifact.workflowId : undefined,
        nodeId: artifact.projectionKind === "workflow-output" ? artifact.nodeId : undefined,
        executionId: artifact.projectionKind === "workflow-output" ? artifact.executionId : undefined,
        provider: artifact.projectionKind === "dataset-export" ? "dataset-studio" : undefined,
      }),
      location: new AssetLocation({
        accessMethod: "local-file",
        location: artifact.location,
        format: artifact.format,
        contentType: artifact.contentType,
      }),
      technicalMetadata: new AssetTechnicalMetadata({
        sha256: artifact.checksum,
        sizeBytes: artifact.byteLength,
      }),
      semanticMetadata: {
        tags: artifact.projectionKind === "uploaded-file"
          ? ["uploaded"]
          : artifact.projectionKind === "dataset-export"
            ? ["dataset-export"]
            : ["workflow-output"],
      },
      audit: {
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.registerAssetUseCase.execute({ asset });
    await this.createAssetVersionUseCase.execute({
      assetId: artifact.assetId,
      versionId,
      createdAt: now,
      contentSha256: artifact.checksum,
      contentLengthBytes: artifact.byteLength,
      metadata: {
        projectionKind: artifact.projectionKind,
      },
      reproducibilitySummary: artifact.projectionKind === "dataset-export"
        ? {
            datasetId: artifact.datasetId,
            datasetVersionId: artifact.datasetVersionId,
          }
        : undefined,
      upstreamVersionIds: artifact.projectionKind === "workflow-output"
        ? artifact.inputVersionIds
        : artifact.projectionKind === "dataset-export"
          ? artifact.sourceVersionIds
          : undefined,
    });

    if (artifact.projectionKind === "uploaded-file") {
      return Object.freeze({ assetId: artifact.assetId, versionId });
    }

    const transformationId = randomId("asset-transform");
    await this.recordTransformationUseCase.execute({
      transformationId,
      kind: artifact.projectionKind === "dataset-export" ? "dataset-export" : "workflow-output",
      status: "completed",
      inputVersionIds: artifact.projectionKind === "workflow-output" ? artifact.inputVersionIds : artifact.sourceVersionIds,
      outputVersionIds: [versionId],
      workflowId: artifact.projectionKind === "workflow-output" ? artifact.workflowId : undefined,
      nodeId: artifact.projectionKind === "workflow-output" ? artifact.nodeId : undefined,
      executionId: artifact.projectionKind === "workflow-output" ? artifact.executionId : undefined,
      provider: artifact.projectionKind === "dataset-export" ? "dataset-studio" : undefined,
      createdAt: now,
      completedAt: now,
      metadata: artifact.projectionKind === "dataset-export"
        ? { datasetId: artifact.datasetId, datasetVersionId: artifact.datasetVersionId }
        : undefined,
    });

    for (const inputVersionId of artifact.projectionKind === "workflow-output"
      ? artifact.inputVersionIds ?? []
      : artifact.sourceVersionIds ?? []) {
      await this.linkLineageUseCase.execute({
        edgeId: randomId("lineage-edge"),
        fromVersionId: inputVersionId,
        toVersionId: versionId,
        transformationId,
        kind: artifact.projectionKind === "workflow-output" ? "generated-from" : "derived-from",
        createdAt: now,
      });
    }

    return Object.freeze({
      assetId: artifact.assetId,
      versionId,
      transformationId,
    });
  }
}
