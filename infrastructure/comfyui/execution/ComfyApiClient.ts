import type {
  ComfyHistoryResponseDto,
  ComfyQueuePromptResponseDto,
  ComfyQueueStateDto,
  ComfyWorkflowDto,
} from "../dto/ComfyWorkflowDto";

export interface IComfyApiClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new Error("ComfyApiClient baseUrl cannot be empty.");
  }

  return normalized;
}

export class ComfyApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: IComfyApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  public async queuePrompt(
    workflow: ComfyWorkflowDto
  ): Promise<ComfyQueuePromptResponseDto> {
    return this.fetchJson<ComfyQueuePromptResponseDto>("/prompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workflow),
    });
  }

  public async getHistory(promptId?: string): Promise<ComfyHistoryResponseDto> {
    const path = promptId
      ? `/history/${encodeURIComponent(promptId)}`
      : "/history";

    return this.fetchJson<ComfyHistoryResponseDto>(path, {
      method: "GET",
    });
  }

  public async getQueue(): Promise<ComfyQueueStateDto> {
    return this.fetchJson<ComfyQueueStateDto>("/queue", {
      method: "GET",
    });
  }

  public async interrupt(): Promise<void> {
    await this.fetchJson<unknown>("/interrupt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  }

  public buildViewUrl(params: {
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
  }): string {
    const search = new URLSearchParams();
    search.set("filename", params.filename);

    if (params.subfolder) {
      search.set("subfolder", params.subfolder);
    }

    if (params.type) {
      search.set("type", params.type);
    }

    return `${this.baseUrl}/view?${search.toString()}`;
  }

  public async downloadFile(params: {
    readonly filename: string;
    readonly subfolder?: string;
    readonly type?: string;
  }): Promise<Uint8Array> {
    const url = this.buildViewUrl(params);
    const response = await this.fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(
        `ComfyUI file download failed with status ${response.status} for '${url}'.`
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private async fetchJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${path}`, init);

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(
        `ComfyUI request failed (${response.status}) for '${path}': ${body || "No response body"}`
      );
    }

    return (await response.json()) as T;
  }

  private async fetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
