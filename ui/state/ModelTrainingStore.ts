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

  public async submitJob(command: Parameters<ModelTrainingService["submitJob"]>[0]): Promise<void> {
    this.patch({ isSubmitting: true, error: undefined });
    try {
      await this.service.submitJob(command);
      this.patch({ isSubmitting: false });
      await this.refresh();
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
