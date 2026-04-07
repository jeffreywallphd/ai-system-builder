import type {
  GetModelTrainingStudioSummaryQuery,
  ModelTrainingStudioSummary,
} from "@application/model-training/contracts";
import type { ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";
import { ModelTrainingService } from "../services/ModelTrainingService";

export interface ModelTrainingStoreState {
  readonly jobs: ReadonlyArray<ModelTrainingJob>;
  readonly summary?: ModelTrainingStudioSummary;
  readonly selectedBaseModelId?: string;
  readonly selectedDatasetId?: string;
  readonly selectedDatasetVersionId?: string;
  readonly pollingActive: boolean;
  readonly isLoading: boolean;
  readonly isSubmitting: boolean;
  readonly promotionJobIds: ReadonlyArray<string>;
  readonly error?: string;
}

export type ModelTrainingStoreListener = (state: ModelTrainingStoreState) => void;

const defaultState: ModelTrainingStoreState = Object.freeze({
  jobs: Object.freeze([]),
  summary: undefined,
  selectedBaseModelId: undefined,
  selectedDatasetId: undefined,
  selectedDatasetVersionId: undefined,
  pollingActive: false,
  isLoading: false,
  isSubmitting: false,
  promotionJobIds: Object.freeze([]),
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

interface TimerScheduler {
  setTimeout(handler: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const defaultScheduler: TimerScheduler = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle),
};

export class ModelTrainingStore {
  private state: ModelTrainingStoreState = defaultState;
  private readonly listeners = new Set<ModelTrainingStoreListener>();
  private pollHandle?: ReturnType<typeof setTimeout>;
  private pollBudgetRemaining = 0;

  constructor(
    private readonly service: ModelTrainingService,
    private readonly pollIntervalMs = 3000,
    private readonly maxPollCycles = 20,
    private readonly scheduler: TimerScheduler = defaultScheduler,
  ) {}

  public getState(): ModelTrainingStoreState {
    return this.state;
  }

  public subscribe(listener: ModelTrainingStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  public async refresh(): Promise<void> {
    return this.refreshSummary();
  }

  public async refreshSummary(query: GetModelTrainingStudioSummaryQuery = this.currentSelection()): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const summary = await this.service.getStudioSummary(query);
      this.patch({
        summary,
        jobs: Object.freeze(summary.jobs.map((entry) => entry.job)),
        selectedBaseModelId: summary.selectedBaseModelId,
        selectedDatasetId: summary.selectedDatasetId,
        selectedDatasetVersionId: summary.selectedDatasetVersionId,
        isLoading: false,
      });
      if (summary.jobs.some((entry) => !isTerminal(entry.job.status)) && this.pollBudgetRemaining <= 0) {
        this.pollBudgetRemaining = this.maxPollCycles;
      }
      this.syncPolling(summary.jobs.map((entry) => entry.job));
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async updateSelection(query: GetModelTrainingStudioSummaryQuery): Promise<void> {
    await this.refreshSummary({
      selectedBaseModelId: query.selectedBaseModelId ?? this.state.selectedBaseModelId,
      selectedDatasetId: query.selectedDatasetId ?? this.state.selectedDatasetId,
      selectedDatasetVersionId: query.selectedDatasetVersionId ?? this.state.selectedDatasetVersionId,
    });
  }

  public async refreshJob(jobId: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const job = await this.service.refreshJob(jobId);
      this.patch({
        isLoading: false,
        jobs: job ? upsertJob(this.state.jobs, job) : this.state.jobs,
      });
      await this.refreshSummary();
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
      await this.refreshSummary();
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
      await this.refreshSummary();
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
    await this.refreshSummary();
  }

  public async promoteJob(jobId: string): Promise<void> {
    this.patch({ promotionJobIds: Object.freeze([...new Set([...this.state.promotionJobIds, jobId])]), error: undefined });
    try {
      await this.service.promoteJob({ jobId });
      this.patch({ promotionJobIds: Object.freeze(this.state.promotionJobIds.filter((entry) => entry !== jobId)) });
      await this.refreshSummary();
    } catch (error) {
      this.patch({
        promotionJobIds: Object.freeze(this.state.promotionJobIds.filter((entry) => entry !== jobId)),
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async submitJob(command: Parameters<ModelTrainingService["submitJob"]>[0]): Promise<void> {
    this.patch({ isSubmitting: true, error: undefined });
    try {
      const job = await this.service.submitJob(command);
      this.patch({ isSubmitting: false, jobs: upsertJob(this.state.jobs, job) });
      this.pollBudgetRemaining = this.maxPollCycles;
      await this.refreshSummary({
        selectedBaseModelId: command.baseModelId,
        selectedDatasetId: command.datasetId,
        selectedDatasetVersionId: command.datasetVersionId,
      });
    } catch (error) {
      this.patch({ isSubmitting: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  private currentSelection(): GetModelTrainingStudioSummaryQuery {
    return Object.freeze({
      selectedBaseModelId: this.state.selectedBaseModelId,
      selectedDatasetId: this.state.selectedDatasetId,
      selectedDatasetVersionId: this.state.selectedDatasetVersionId,
    });
  }

  private syncPolling(jobs: ReadonlyArray<ModelTrainingJob>): void {
    const hasActiveJobs = jobs.some((job) => !isTerminal(job.status));
    if (!hasActiveJobs || this.pollBudgetRemaining <= 0) {
      this.stopPolling();
      return;
    }

    if (this.pollHandle) {
      return;
    }

    this.patch({ pollingActive: true });
    this.pollHandle = this.scheduler.setTimeout(() => {
      this.pollHandle = undefined;
      void this.refreshActiveJobs().finally(() => {
        this.pollBudgetRemaining -= 1;
        this.syncPolling(this.state.jobs);
      });
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      this.scheduler.clearTimeout(this.pollHandle);
      this.pollHandle = undefined;
    }
    this.pollBudgetRemaining = 0;
    if (this.state.pollingActive) {
      this.patch({ pollingActive: false });
    }
  }

  private patch(patch: Partial<ModelTrainingStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      jobs: patch.jobs ? Object.freeze([...patch.jobs]) : this.state.jobs,
      promotionJobIds: patch.promotionJobIds ? Object.freeze([...patch.promotionJobIds]) : this.state.promotionJobIds,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

