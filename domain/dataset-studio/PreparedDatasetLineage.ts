import type { CanonicalRecordValue } from "./CanonicalDataShapes";
import type { PipelineStageId } from "./PipelineStageDomain";

export interface PreparedDatasetLineageSourceReference {
  readonly referenceId: string;
  readonly sourceKind?: string;
  readonly sourceReference?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface PreparedDatasetLineageAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relationship: "source" | "pipeline" | "stage-output" | "prepared-storage";
  readonly stageId?: PipelineStageId;
}

export interface PreparedDatasetLineagePipelineReference {
  readonly pipelineAssetId: string;
  readonly pipelineVersionId?: string;
  readonly outputStageId?: PipelineStageId;
  readonly outputAssetGroupIds: ReadonlyArray<string>;
}

export interface PreparedDatasetLineageStageReference {
  readonly stageId: PipelineStageId;
  readonly order: number;
  readonly status: "current" | "completed" | "skipped" | "pending" | "disabled";
  readonly isOptional: boolean;
  readonly isAvailable: boolean;
  readonly activationMode: "always" | "conditional" | "disabled";
  readonly configMode: "simple" | "advanced";
  readonly optionKeys: ReadonlyArray<string>;
  readonly assetGroupIds: ReadonlyArray<string>;
  readonly dependsOnStageIds: ReadonlyArray<PipelineStageId>;
}

export interface PreparedDatasetLineageOutputReference {
  readonly preparedAssetId: string;
  readonly preparedAssetVersionId?: string;
  readonly outputShapeKind: string;
  readonly storageTargetId?: string;
  readonly storageReference?: string;
}

export interface PreparedDatasetPreparationContext {
  readonly templateId?: string;
  readonly templateIntent?: string;
  readonly authoringMode: "wizard" | "canvas";
  readonly presentationMode: "simple" | "advanced";
  readonly currentStageId: PipelineStageId;
  readonly completedStageIds: ReadonlyArray<PipelineStageId>;
  readonly skippedStageIds: ReadonlyArray<PipelineStageId>;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface PreparedDatasetLineageRecord {
  readonly schemaVersion: "1.0.0";
  readonly lineageId: string;
  readonly capturedAt: string;
  readonly pipeline: {
    readonly pipelineId: string;
    readonly pipelineAssetId: string;
    readonly pipelineAssetVersionId: string;
  };
  readonly upstream: {
    readonly sources: ReadonlyArray<PreparedDatasetLineageSourceReference>;
    readonly assets: ReadonlyArray<PreparedDatasetLineageAssetReference>;
    readonly pipelines: ReadonlyArray<PreparedDatasetLineagePipelineReference>;
  };
  readonly stages: ReadonlyArray<PreparedDatasetLineageStageReference>;
  readonly output: PreparedDatasetLineageOutputReference;
  readonly preparationContext: PreparedDatasetPreparationContext;
}

export interface PreparedDatasetReuseReference {
  readonly reuseId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly displayName: string;
  readonly reusable: boolean;
  readonly lineageId: string;
  readonly pipelineAssetId: string;
  readonly discoverability: {
    readonly semanticRole: "dataset";
    readonly sourceType: "data-studio";
    readonly tags: ReadonlyArray<string>;
    readonly upstreamAssetIds: ReadonlyArray<string>;
  };
}
