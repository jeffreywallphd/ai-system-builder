export type ModelTrainingBackend = "python-runtime-manifest";
export type ModelTrainingJobStatus = "queued" | "running" | "completed" | "failed" | "unsupported";
export type ModelTrainingArtifactKind = "training-manifest" | "adapter-bundle" | "checkpoint" | "log";
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

export interface ModelTrainingJob {
  readonly id: string;
  readonly name: string;
  readonly backend: ModelTrainingBackend;
  readonly baseModelId: string;
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly status: ModelTrainingJobStatus;
  readonly configuration: ModelTrainingConfiguration;
  readonly diagnostics: ReadonlyArray<ModelTrainingDiagnostic>;
  readonly artifacts: ReadonlyArray<ModelTrainingArtifact>;
  readonly checkpoints: ReadonlyArray<ModelTrainingCheckpoint>;
  readonly outputModelName?: string;
  readonly summary?: string;
}
