import type { ComfyNodeDto } from "./ComfyNodeDto";

export interface ComfyWorkflowDto {
  readonly prompt: Readonly<Record<string, ComfyNodeDto>>;
  readonly client_id: string;
}

export interface ComfyQueuePromptResponseDto {
  readonly prompt_id: string;
  readonly number?: number;
  readonly node_errors?: Readonly<Record<string, unknown>>;
}

export interface ComfyHistoryPromptOutputDto {
  readonly images?: ReadonlyArray<{
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
  }>;
  readonly gifs?: ReadonlyArray<{
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
    readonly format?: string;
  }>;
  readonly audio?: ReadonlyArray<{
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
    readonly format?: string;
  }>;
  readonly text?: ReadonlyArray<{
    readonly text: string;
  }>;
}

export interface ComfyHistoryPromptEntryDto {
  readonly prompt?: ReadonlyArray<unknown>;
  readonly outputs?: Readonly<Record<string, ComfyHistoryPromptOutputDto>>;
  readonly status?: {
    readonly status_str?: string;
    readonly completed?: boolean;
    readonly messages?: ReadonlyArray<unknown>;
  };
}

export interface ComfyHistoryResponseDto {
  readonly [promptId: string]: ComfyHistoryPromptEntryDto;
}

export interface ComfyQueueStateDto {
  readonly queue_running?: ReadonlyArray<unknown>;
  readonly queue_pending?: ReadonlyArray<unknown>;
}
