import type { ModelTrainingArtifact, ModelTrainingCheckpoint, ModelTrainingConfiguration, ModelTrainingDiagnostic, ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";
import type { IModelTrainingJobRepository } from "@application/ports/interfaces/IModelTrainingJobRepository";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PersistedJob {
  readonly id: string;
  readonly name: string;
  readonly backend: ModelTrainingJob["backend"];
  readonly executionKind: ModelTrainingJob["executionKind"];
  readonly baseModelId: string;
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly status: ModelTrainingJob["status"];
  readonly configuration: ModelTrainingConfiguration;
  readonly diagnostics: ReadonlyArray<ModelTrainingDiagnostic>;
  readonly artifacts: ReadonlyArray<Omit<ModelTrainingArtifact, "createdAt"> & { readonly createdAt: string }>;
  readonly checkpoints: ReadonlyArray<Omit<ModelTrainingCheckpoint, "createdAt"> & { readonly createdAt: string }>;
  readonly outputModelName?: string;
  readonly summary?: string;
  readonly progress?: {
    readonly percent: number;
    readonly currentEpoch?: number;
    readonly totalEpochs?: number;
    readonly currentStep?: number;
    readonly totalSteps?: number;
    readonly latestMetricName?: string;
    readonly latestMetricValue?: number;
    readonly statusDetail?: string;
  };
  readonly provenance: {
    readonly executionKind: ModelTrainingJob["executionKind"];
    readonly backend: ModelTrainingJob["backend"];
    readonly truthfulness: ModelTrainingJob["provenance"]["truthfulness"];
    readonly runtime: ModelTrainingJob["provenance"]["runtime"];
    readonly runMode: ModelTrainingJob["provenance"]["runMode"];
    readonly supportsGradientTraining: boolean;
    readonly isPreparationOnly: boolean;
    readonly provider?: string;
    readonly modelIdentity?: string;
    readonly path: string;
    readonly fallbackReason?: string;
    readonly diagnostics: ReadonlyArray<ModelTrainingDiagnostic>;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly detail?: string;
  };
}

function defaultStorage(): StorageLike | undefined {
  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }

  return window.localStorage;
}

export class LocalStorageModelTrainingJobRepository implements IModelTrainingJobRepository {
  constructor(
    private readonly key: string = "ai-loom:model-training-jobs",
    private readonly storage: StorageLike | undefined = defaultStorage(),
  ) {}

  public async listJobs(): Promise<ReadonlyArray<ModelTrainingJob>> {
    return this.read().map((job) => this.toDomain(job));
  }

  public async getJobById(id: string): Promise<ModelTrainingJob | undefined> {
    const normalizedId = id.trim();
    return this.read().map((job) => this.toDomain(job)).find((job) => job.id === normalizedId);
  }

  public async saveJob(job: ModelTrainingJob): Promise<void> {
    const records = this.read();
    const next = this.toRecord(job);
    const index = records.findIndex((record) => record.id === job.id);
    if (index >= 0) {
      records[index] = next;
    } else {
      records.push(next);
    }
    this.write(records);
  }

  private read(): PersistedJob[] {
    const raw = this.storage?.getItem(this.key);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as PersistedJob[];
  }

  private write(records: ReadonlyArray<PersistedJob>): void {
    this.storage?.setItem(this.key, JSON.stringify(records, null, 2));
  }

  private toRecord(job: ModelTrainingJob): PersistedJob {
    return {
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      submittedAt: job.submittedAt?.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      artifacts: job.artifacts.map((artifact) => ({ ...artifact, createdAt: artifact.createdAt.toISOString() })),
      checkpoints: job.checkpoints.map((checkpoint) => ({ ...checkpoint, createdAt: checkpoint.createdAt.toISOString() })),
    };
  }

  private toDomain(job: PersistedJob): ModelTrainingJob {
    return Object.freeze({
      ...job,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
      submittedAt: job.submittedAt ? new Date(job.submittedAt) : undefined,
      startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
      completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
      artifacts: Object.freeze(job.artifacts.map((artifact) => Object.freeze({ ...artifact, createdAt: new Date(artifact.createdAt) }))),
      checkpoints: Object.freeze(job.checkpoints.map((checkpoint) => Object.freeze({ ...checkpoint, createdAt: new Date(checkpoint.createdAt) }))),
      diagnostics: Object.freeze(job.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))),
      progress: job.progress ? Object.freeze({ ...job.progress }) : undefined,
      provenance: Object.freeze({ ...job.provenance }),
    });
  }
}

