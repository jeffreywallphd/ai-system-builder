import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";
import { ModelTrainingService } from "../services/ModelTrainingService";

export interface ModelTrainingStoreState {
  readonly jobs: ReadonlyArray<ModelTrainingJob>;
  readonly isLoading: boolean;
  readonly isSubmitting: boolean;
  readonly error?: string;
}

export type ModelTrainingStoreListener = (state: ModelTrainingStoreState) => void;

const defaultState: ModelTrainingStoreState = Object.freeze({
  jobs: Object.freeze([]),
  isLoading: false,
  isSubmitting: false,
  error: undefined,
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected model training error.";
}

function upsertJob(jobs: ReadonlyArray<ModelTrainingJob>, job: ModelTrainingJob): ReadonlyArray<ModelTrainingJob> {
  const next = [...jobs];
  const existingIndex = next.findIndex((entry) => entry.id === job.id);
  if (existingIndex >= 0) {
    next[existingIndex] = job;
  } else {
    next.unshift(job);
  }
  next.sort((left, right) => {
    const rightTime = right.submittedAt?.getTime() ?? right.createdAt.getTime();
    const leftTime = left.submittedAt?.getTime() ?? left.createdAt.getTime();
    return rightTime - leftTime;
  });
  return Object.freeze(next);
}

function isTerminal(status: ModelTrainingJob["status"]): boolean {
  return ["completed", "failed", "cancelled", "partially-completed", "exported-without-training"].includes(status);
}

export class ModelTrainingStore {
  private state: ModelTrainingStoreState = defaultState;
  private readonly listeners = new Set<ModelTrainingStoreListener>();

  constructor(private readonly service: ModelTrainingService) {}

  public getState(): ModelTrainingStoreState {
    return this.state;
  }

  public subscribe(listener: ModelTrainingStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async refresh(): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const jobs = await this.service.listJobs();
      this.patch({ jobs: Object.freeze([...jobs]), isLoading: false });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async refreshJob(jobId: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const job = await this.service.refreshJob(jobId);
      this.patch({
        isLoading: false,
        jobs: job ? upsertJob(this.state.jobs, job) : this.state.jobs,
      });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async reconcileJob(jobId: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const job = await this.service.reconcileJob(jobId);
      this.patch({
        isLoading: false,
        jobs: job ? upsertJob(this.state.jobs, job) : this.state.jobs,
      });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async cancelJob(jobId: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const job = await this.service.cancelJob(jobId);
      this.patch({ isLoading: false, jobs: upsertJob(this.state.jobs, job) });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async refreshActiveJobs(): Promise<void> {
    const activeJobs = this.state.jobs.filter((job) => !isTerminal(job.status));
    await Promise.all(activeJobs.map((job) => this.service.refreshJob(job.id).then((result) => {
      if (result) {
        this.patch({ jobs: upsertJob(this.state.jobs, result) });
      }
    }).catch(() => undefined)));
  }

  public async submitJob(command: Parameters<ModelTrainingService["submitJob"]>[0]): Promise<void> {
    this.patch({ isSubmitting: true, error: undefined });
    try {
      const job = await this.service.submitJob(command);
      this.patch({ isSubmitting: false, jobs: upsertJob(this.state.jobs, job) });
      await this.refreshActiveJobs();
    } catch (error) {
      this.patch({ isSubmitting: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  private patch(patch: Partial<ModelTrainingStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      jobs: patch.jobs ? Object.freeze([...patch.jobs]) : this.state.jobs,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
