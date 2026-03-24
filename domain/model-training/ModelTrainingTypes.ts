export const MODEL_TRAINING_BACKENDS = Object.freeze([
  "python-runtime-local",
  "python-runtime-manifest",
] as const);
export type ModelTrainingBackend = (typeof MODEL_TRAINING_BACKENDS)[number];

export const MODEL_TRAINING_EXECUTION_KINDS = Object.freeze([
  "preparation-only",
  "local-gradient-training",
] as const);
export type ModelTrainingExecutionKind = (typeof MODEL_TRAINING_EXECUTION_KINDS)[number];

export const MODEL_TRAINING_JOB_STATUSES = Object.freeze([
  "submitted",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "reconciliation-needed",
  "partially-completed",
  "exported-without-training",
] as const);
export type ModelTrainingJobStatus = (typeof MODEL_TRAINING_JOB_STATUSES)[number];

export const MODEL_TRAINING_ARTIFACT_KINDS = Object.freeze([
  "training-manifest",
  "prepared-bundle",
  "checkpoint",
  "trained-model",
  "metrics",
  "log",
  "diagnostic",
] as const);
export type ModelTrainingArtifactKind = (typeof MODEL_TRAINING_ARTIFACT_KINDS)[number];

export type ModelTrainingDiagnosticLevel = "info" | "warning" | "error";

export interface ModelTrainingConfiguration {
  readonly epochs: number;
  readonly learningRate: number;
  readonly batchSize: number;
  readonly notes?: string;
}

export interface ModelTrainingArtifact {
  readonly id: string;
  readonly kind: ModelTrainingArtifactKind;
  readonly label: string;
  readonly location?: string;
  readonly contentType?: string;
  readonly createdAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ModelTrainingCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly epoch: number;
  readonly metricName?: string;
  readonly metricValue?: number;
  readonly createdAt: Date;
  readonly artifactId?: string;
}

export interface ModelTrainingDiagnostic {
  readonly code: string;
  readonly level: ModelTrainingDiagnosticLevel;
  readonly message: string;
  readonly detail?: string;
}

export interface ModelTrainingProgress {
  readonly percent: number;
  readonly currentEpoch?: number;
  readonly totalEpochs?: number;
  readonly currentStep?: number;
  readonly totalSteps?: number;
  readonly latestMetricName?: string;
  readonly latestMetricValue?: number;
  readonly statusDetail?: string;
}

export type ModelTrainingTruthfulness = "preparation-only" | "real-execution" | "exported-without-training" | "fallback";
export type ModelTrainingRunMode = "preparation-only" | "local-gradient-training";

export interface ModelTrainingProvenance {
  readonly executionKind: ModelTrainingExecutionKind;
  readonly backend: ModelTrainingBackend;
  readonly truthfulness: ModelTrainingTruthfulness;
  readonly runtime: "python-runtime";
  readonly runMode: ModelTrainingRunMode;
  readonly supportsGradientTraining: boolean;
  readonly isPreparationOnly: boolean;
  readonly provider?: string;
  readonly modelIdentity?: string;
  readonly path: string;
  readonly fallbackReason?: string;
  readonly diagnostics: ReadonlyArray<ModelTrainingDiagnostic>;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly detail?: string;
}

export interface ModelTrainingJob {
  readonly id: string;
  readonly name: string;
  readonly backend: ModelTrainingBackend;
  readonly executionKind: ModelTrainingExecutionKind;
  readonly baseModelId: string;
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt?: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly status: ModelTrainingJobStatus;
  readonly configuration: ModelTrainingConfiguration;
  readonly diagnostics: ReadonlyArray<ModelTrainingDiagnostic>;
  readonly artifacts: ReadonlyArray<ModelTrainingArtifact>;
  readonly checkpoints: ReadonlyArray<ModelTrainingCheckpoint>;
  readonly outputModelName?: string;
  readonly summary?: string;
  readonly progress?: ModelTrainingProgress;
  readonly provenance: ModelTrainingProvenance;
}
