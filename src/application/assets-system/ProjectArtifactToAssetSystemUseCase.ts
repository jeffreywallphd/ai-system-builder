import { Asset } from "@domain/assets/Asset";
import { AssetLocation, AssetSourceInfo, AssetTechnicalMetadata } from "@domain/assets/AssetMetadata";
import type { AssetKind } from "@domain/assets/interfaces/IAsset";
import { RegisterAssetUseCase } from "./RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "./CreateAssetVersionUseCase";
import { RecordAssetTransformationUseCase } from "./RecordAssetTransformationUseCase";

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
      readonly transformationStatus?: "success" | "failed" | "partial" | "degraded";
    }
  | {
      readonly projectionKind: "model-artifact";
      readonly assetId: string;
      readonly name: string;
      readonly modelTrainingJobId: string;
      readonly location: string;
      readonly format?: string;
      readonly contentType?: string;
      readonly checksum?: string;
      readonly byteLength?: number;
      readonly sourceVersionIds?: ReadonlyArray<string>;
      readonly provider?: string;
      readonly runtime?: string;
      readonly transformationStatus?: "success" | "failed" | "partial" | "degraded";
      readonly metadata?: Readonly<Record<string, unknown>>;
    };

export class ProjectArtifactToAssetSystemUseCase {
  constructor(
    private readonly registerAssetUseCase: RegisterAssetUseCase,
    private readonly createAssetVersionUseCase: CreateAssetVersionUseCase,
    private readonly recordTransformationUseCase: RecordAssetTransformationUseCase,
  ) {}

  public async execute(artifact: ProjectableArtifact): Promise<{ readonly assetId: string; readonly versionId: string; readonly transformationId?: string }> {
    const now = new Date();
    const versionId = randomId("asset-version");

    const asset = new Asset({
      id: artifact.assetId,
      name: artifact.name,
      kind: artifact.projectionKind === "dataset-export"
        ? "dataset"
        : artifact.projectionKind === "model-artifact"
          ? "model-output"
        : resolveAssetKindFromContentType(artifact.contentType),
      status: "available",
      source: new AssetSourceInfo({
        type: artifact.projectionKind === "uploaded-file" ? "uploaded" : "generated",
        workflowId: artifact.projectionKind === "workflow-output" ? artifact.workflowId : undefined,
        nodeId: artifact.projectionKind === "workflow-output" ? artifact.nodeId : undefined,
        executionId: artifact.projectionKind === "workflow-output" ? artifact.executionId : undefined,
        provider: artifact.projectionKind === "dataset-export"
          ? "dataset-studio"
          : artifact.projectionKind === "model-artifact"
            ? artifact.provider
            : undefined,
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
            : artifact.projectionKind === "model-artifact"
              ? ["model-artifact"]
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
        : artifact.projectionKind === "model-artifact"
          ? {
              modelTrainingJobId: artifact.modelTrainingJobId,
            }
        : undefined,
      upstreamVersionIds: artifact.projectionKind === "workflow-output"
        ? artifact.inputVersionIds
        : artifact.projectionKind === "dataset-export"
          ? artifact.sourceVersionIds
          : artifact.projectionKind === "model-artifact"
            ? artifact.sourceVersionIds
          : undefined,
    });

    if (artifact.projectionKind === "uploaded-file") {
      return Object.freeze({ assetId: artifact.assetId, versionId });
    }

    const transformationId = randomId("asset-transform");
    await this.recordTransformationUseCase.execute({
      transformationId,
      transformationType: artifact.projectionKind === "dataset-export"
        ? "dataset-export"
        : artifact.projectionKind === "model-artifact"
          ? "model-artifact"
          : "workflow-output",
      status: artifact.projectionKind === "workflow-output" || artifact.projectionKind === "model-artifact"
        ? artifact.transformationStatus ?? "success"
        : "success",
      inputVersionIds: artifact.projectionKind === "workflow-output"
        ? artifact.inputVersionIds
        : artifact.projectionKind === "dataset-export" || artifact.projectionKind === "model-artifact"
          ? artifact.sourceVersionIds
          : undefined,
      outputVersionIds: [versionId],
      workflowId: artifact.projectionKind === "workflow-output" ? artifact.workflowId : undefined,
      nodeId: artifact.projectionKind === "workflow-output" ? artifact.nodeId : undefined,
      executionId: artifact.projectionKind === "workflow-output" ? artifact.executionId : undefined,
      provider: artifact.projectionKind === "dataset-export"
        ? "dataset-studio"
        : artifact.projectionKind === "model-artifact"
          ? artifact.provider
          : undefined,
      runtime: artifact.projectionKind === "model-artifact" ? artifact.runtime : undefined,
      createdAt: now,
      completedAt: now,
      metadata: artifact.projectionKind === "dataset-export"
        ? { datasetId: artifact.datasetId, datasetVersionId: artifact.datasetVersionId }
        : artifact.projectionKind === "model-artifact"
          ? {
              modelTrainingJobId: artifact.modelTrainingJobId,
              ...(artifact.metadata ?? {}),
            }
        : undefined,
    });

    return Object.freeze({
      assetId: artifact.assetId,
      versionId,
      transformationId,
    });
  }
}

