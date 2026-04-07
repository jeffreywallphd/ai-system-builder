import type { AppRuntimeMode } from "@domain/runtime/AppRuntimeMode";
import type {
  ModelCreationCapability,
  ModelCreationPath,
  ModelCreationRecommendedAction,
  ModelCreationSupportState,
  ModelCreationRuntimeStatus,
} from "@domain/model-training/ModelCreationSupport";
import type {
  ModelTrainingArtifact,
  ModelTrainingConfiguration,
  ModelTrainingExecutionKind,
  ModelTrainingJob,
} from "@domain/model-training/ModelTrainingTypes";
import type { DatasetTaskType } from "@domain/tuning-datasets/interfaces/ITuningDatasetStudio";

export interface SubmitModelTrainingJobCommand {
  readonly id?: string;
  readonly name: string;
  readonly baseModelId: string;
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly createdBy: string;
  readonly configuration: ModelTrainingConfiguration;
  readonly executionKind?: ModelTrainingExecutionKind;
}

export interface GetModelTrainingStudioSummaryQuery {
  readonly selectedBaseModelId?: string;
  readonly selectedDatasetId?: string;
  readonly selectedDatasetVersionId?: string;
}

export interface ModelTrainingBaseModelOption {
  readonly id: string;
  readonly name: string;
  readonly accessMethod: string;
  readonly isAvailable: boolean;
  readonly supportsExportPreparation: boolean;
  readonly supportsLocalTraining: boolean;
  readonly localTrainingReason?: string;
  readonly artifactLocation?: string;
}

export interface ModelTrainingDatasetVersionOption {
  readonly datasetId: string;
  readonly datasetName: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly versionLabel: string;
  readonly taskType: DatasetTaskType;
  readonly supportsExportPreparation: boolean;
  readonly supportsLocalTraining: boolean;
  readonly localTrainingReason?: string;
}

export interface ModelTrainingReadinessCheck {
  readonly id: string;
  readonly title: string;
  readonly state: ModelCreationSupportState;
  readonly detail: string;
}

export interface ModelTrainingStudioAction {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly path?: ModelCreationPath;
  readonly disabled: boolean;
}

export interface ModelTrainingPromotionSummary {
  readonly state: "available" | "unavailable" | "completed";
  readonly label: string;
  readonly detail: string;
  readonly artifact?: ModelTrainingArtifact;
  readonly promotedModelId?: string;
  readonly promotedModelName?: string;
}

export interface ModelTrainingJobStudioSummary {
  readonly job: ModelTrainingJob;
  readonly userFacingStatus: string;
  readonly technicalSummary?: string;
  readonly technicalDetails?: Readonly<Record<string, unknown>>;
  readonly primaryArtifact?: ModelTrainingArtifact;
  readonly promotion: ModelTrainingPromotionSummary;
}

export interface PromoteModelTrainingJobCommand {
  readonly jobId: string;
  readonly artifactId?: string;
  readonly promotedModelName?: string;
}

export interface PromoteModelTrainingJobResult {
  readonly status: "registered";
  readonly modelId: string;
  readonly modelName: string;
  readonly detail: string;
}

export interface ModelTrainingStudioSummary {
  readonly runtimeMode: AppRuntimeMode;
  readonly runtimeStatus: ModelCreationRuntimeStatus;
  readonly runtimeHeadline: string;
  readonly runtimeDetail: string;
  readonly capability: ModelCreationCapability;
  readonly availablePaths: ReadonlyArray<ModelCreationPath>;
  readonly selectedBaseModelId?: string;
  readonly selectedDatasetId?: string;
  readonly selectedDatasetVersionId?: string;
  readonly baseModels: ReadonlyArray<ModelTrainingBaseModelOption>;
  readonly datasetVersions: ReadonlyArray<ModelTrainingDatasetVersionOption>;
  readonly readinessChecks: ReadonlyArray<ModelTrainingReadinessCheck>;
  readonly availableActions: ReadonlyArray<ModelTrainingStudioAction>;
  readonly modeWarnings: ReadonlyArray<string>;
  readonly recommendedNextSteps: ReadonlyArray<ModelCreationRecommendedAction>;
  readonly jobs: ReadonlyArray<ModelTrainingJobStudioSummary>;
}

