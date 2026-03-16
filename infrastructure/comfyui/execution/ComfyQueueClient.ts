import type {
  ComfyHistoryPromptEntryDto,
  ComfyQueuePromptResponseDto,
  ComfyQueueStateDto,
  ComfyWorkflowDto,
} from "../dto/ComfyWorkflowDto";
import { ComfyApiClient } from "./ComfyApiClient";

export interface IComfyQueueClientOptions {
  readonly apiClient: ComfyApiClient;
  readonly pollIntervalMs?: number;
  readonly maxWaitMs?: number;
}

export interface IComfyPromptProgress {
  readonly promptId: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
  readonly message?: string;
  readonly queuePosition?: number;
  readonly historyEntry?: ComfyHistoryPromptEntryDto;
}

export class ComfyQueueClient {
  private readonly apiClient: ComfyApiClient;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;

  constructor(options: IComfyQueueClientOptions) {
    this.apiClient = options.apiClient;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.maxWaitMs = options.maxWaitMs ?? 1000 * 60 * 60;
  }

  public async enqueuePrompt(
    workflow: ComfyWorkflowDto
  ): Promise<ComfyQueuePromptResponseDto> {
    return this.apiClient.queuePrompt(workflow);
  }

  public async getPromptProgress(promptId: string): Promise<IComfyPromptProgress> {
    const normalizedPromptId = promptId.trim();

    if (!normalizedPromptId) {
      throw new Error("ComfyQueueClient.getPromptProgress requires a promptId.");
    }

    const history = await this.apiClient.getHistory(normalizedPromptId);
    const historyEntry = history[normalizedPromptId];

    if (historyEntry) {
      const completed = !!historyEntry.status?.completed;
      const statusStr = historyEntry.status?.status_str?.toLowerCase() ?? "";

      if (completed) {
        return Object.freeze({
          promptId: normalizedPromptId,
          status: "completed",
          message: historyEntry.status?.status_str,
          historyEntry,
        });
      }

      if (statusStr.includes("error") || statusStr.includes("failed")) {
        return Object.freeze({
          promptId: normalizedPromptId,
          status: "failed",
          message: historyEntry.status?.status_str,
          historyEntry,
        });
      }

      return Object.freeze({
        promptId: normalizedPromptId,
        status: "running",
        message: historyEntry.status?.status_str,
        historyEntry,
      });
    }

    const queue = await this.apiClient.getQueue();
    const queuePosition = this.findQueuePosition(queue, normalizedPromptId);

    if (queuePosition !== undefined) {
      return Object.freeze({
        promptId: normalizedPromptId,
        status: queuePosition === 0 ? "running" : "queued",
        queuePosition,
      });
    }

    return Object.freeze({
      promptId: normalizedPromptId,
      status: "queued",
    });
  }

  public async waitForCompletion(
    promptId: string,
    onProgress?: (progress: IComfyPromptProgress) => void
  ): Promise<ComfyHistoryPromptEntryDto> {
    const startedAt = Date.now();
    const normalizedPromptId = promptId.trim();

    while (Date.now() - startedAt < this.maxWaitMs) {
      const progress = await this.getPromptProgress(normalizedPromptId);
      onProgress?.(progress);

      if (progress.status === "completed") {
        if (!progress.historyEntry) {
          throw new Error(
            `ComfyUI prompt '${normalizedPromptId}' completed without a history entry.`
          );
        }

        return progress.historyEntry;
      }

      if (progress.status === "failed") {
        throw new Error(
          `ComfyUI prompt '${normalizedPromptId}' failed: ${progress.message ?? "Unknown error"}`
        );
      }

      if (progress.status === "cancelled") {
        throw new Error(`ComfyUI prompt '${normalizedPromptId}' was cancelled.`);
      }

      await delay(this.pollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for ComfyUI prompt '${normalizedPromptId}' to complete.`
    );
  }

  public async cancelPrompt(_promptId: string): Promise<void> {
    await this.apiClient.interrupt();
  }

  private findQueuePosition(
    queue: ComfyQueueStateDto,
    promptId: string
  ): number | undefined {
    const running = queue.queue_running ?? [];
    const pending = queue.queue_pending ?? [];

    const all = [...running, ...pending];

    for (let index = 0; index < all.length; index += 1) {
      const item = all[index];

      if (containsPromptId(item, promptId)) {
        return index;
      }
    }

    return undefined;
  }
}

function containsPromptId(value: unknown, promptId: string): boolean {
  if (typeof value === "string") {
    return value === promptId;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsPromptId(item, promptId));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsPromptId(item, promptId));
  }

  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
