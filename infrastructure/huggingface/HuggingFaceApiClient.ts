/**
 * Lightweight Hugging Face API client for infrastructure use.
 *
 * Design goals:
 * - no coupling to UI
 * - usable by catalog + downloader
 * - minimal assumptions about Hugging Face payload stability
 * - graceful fallback behavior when some metadata is missing
 *
 * This client intentionally returns infrastructure-shaped data, not domain models.
 * Mapping into domain objects happens in HuggingFaceModelCatalog.
 */

export interface IHuggingFaceApiClientOptions {
  readonly baseUrl?: string;
  readonly authToken?: string;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

export interface IHuggingFaceModelSearchItem {
  readonly id: string;
  readonly author?: string;
  readonly pipeline_tag?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly downloads?: number;
  readonly likes?: number;
  readonly private?: boolean;
  readonly gated?: boolean | "auto";
  readonly disabled?: boolean;
  readonly createdAt?: string;
  readonly lastModified?: string;
  readonly siblings?: ReadonlyArray<{
    readonly rfilename?: string;
  }>;
}

export interface IHuggingFaceModelInfo {
  readonly id: string;
  readonly author?: string;
  readonly sha?: string;
  readonly private?: boolean;
  readonly gated?: boolean | "auto";
  readonly disabled?: boolean;
  readonly tags?: ReadonlyArray<string>;
  readonly pipeline_tag?: string;
  readonly downloads?: number;
  readonly likes?: number;
  readonly cardData?: Readonly<Record<string, unknown>>;
  readonly siblings?: ReadonlyArray<{
    readonly rfilename?: string;
    readonly size?: number;
    readonly lfs?: {
      readonly sha256?: string;
      readonly size?: number;
    };
  }>;
  readonly createdAt?: string;
  readonly lastModified?: string;
}

export interface IHuggingFaceModelFileInfo {
  readonly path: string;
  readonly sizeBytes?: number;
  readonly sha256?: string;
  readonly downloadUrl: string;
}

export class HuggingFaceApiClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(options: IHuggingFaceApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://huggingface.co").replace(/\/+$/, "");
    this.authToken = options.authToken?.trim() || undefined;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.userAgent = options.userAgent?.trim() || "AI-Loom-Studio/1.0";
  }

  public async searchModels(params: {
    readonly query?: string;
    readonly limit?: number;
    readonly cursor?: string;
    readonly pipelineTag?: string;
    readonly author?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly full?: boolean;
    readonly gated?: boolean;
  } = {}): Promise<ReadonlyArray<IHuggingFaceModelSearchItem>> {
    const searchParams = new URLSearchParams();

    if (params.query?.trim()) {
      searchParams.set("search", params.query.trim());
    }

    if (params.limit && params.limit > 0) {
      searchParams.set("limit", String(params.limit));
    }

    if (params.pipelineTag?.trim()) {
      searchParams.set("pipeline_tag", params.pipelineTag.trim());
    }

    if (params.author?.trim()) {
      searchParams.set("author", params.author.trim());
    }

    if (params.tags && params.tags.length > 0) {
      for (const tag of params.tags) {
        if (tag.trim()) {
          searchParams.append("filter", tag.trim());
        }
      }
    }

    if (params.full ?? true) {
      searchParams.set("full", "true");
    }

    if (params.gated !== undefined) {
      searchParams.set("gated", String(params.gated));
    }

    // The public HF API does not expose a stable "cursor" for this endpoint in a way
    // we can rely on here, so cursor is currently ignored by this implementation.
    void params.cursor;

    const response = await this.fetchJson<ReadonlyArray<IHuggingFaceModelSearchItem>>(
      `/api/models?${searchParams.toString()}`
    );

    return Object.freeze([...(response ?? [])]);
  }

  public async getModelInfo(modelId: string): Promise<IHuggingFaceModelInfo | undefined> {
    const normalizedModelId = modelId.trim();

    if (!normalizedModelId) {
      throw new Error("HuggingFaceApiClient.getModelInfo requires a non-empty modelId.");
    }

    const encodedModelId = normalizedModelId
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    try {
      return await this.fetchJson<IHuggingFaceModelInfo>(
        `/api/models/${encodedModelId}`
      );
    } catch (error: unknown) {
      if (this.isHttpStatus(error, 404)) {
        return undefined;
      }

      throw error;
    }
  }

  public async resolveDownloadFile(params: {
    readonly modelId: string;
    readonly revision?: string;
    readonly preferredExtensions?: ReadonlyArray<string>;
    readonly preferredFileNames?: ReadonlyArray<string>;
  }): Promise<IHuggingFaceModelFileInfo | undefined> {
    const modelId = params.modelId.trim();
    if (!modelId) {
      throw new Error("HuggingFaceApiClient.resolveDownloadFile requires a non-empty modelId.");
    }

    const info = await this.getModelInfo(modelId);

    if (!info) {
      return undefined;
    }

    const siblings = [...(info.siblings ?? [])];
    if (siblings.length === 0) {
      return undefined;
    }

    const preferredExtensions = (params.preferredExtensions ?? []).map((value) =>
      value.trim().toLowerCase()
    );
    const preferredFileNames = (params.preferredFileNames ?? []).map((value) =>
      value.trim().toLowerCase()
    );

    const scored = siblings
      .filter((sibling) => !!sibling.rfilename)
      .map((sibling) => {
        const fileName = sibling.rfilename!;
        const lower = fileName.toLowerCase();

        let score = 0;

        if (preferredFileNames.includes(lower)) {
          score += 500;
        }

        for (const extension of preferredExtensions) {
          if (lower.endsWith(extension)) {
            score += 200;
          }
        }

        if (lower.endsWith(".safetensors")) score += 100;
        if (lower.endsWith(".gguf")) score += 95;
        if (lower.endsWith(".onnx")) score += 90;
        if (lower.endsWith(".bin")) score += 50;
        if (lower.endsWith(".pt")) score += 40;
        if (lower.endsWith(".pth")) score += 35;
        if (lower.endsWith(".ckpt")) score += 25;

        if (lower.includes("model")) score += 10;
        if (lower.includes("pytorch_model")) score += 15;
        if (lower.includes("adapter_model")) score += 12;

        return {
          sibling,
          score,
        };
      })
      .sort((left, right) => right.score - left.score);

    const selected = scored[0]?.sibling;

    if (!selected?.rfilename) {
      return undefined;
    }

    const revision = params.revision?.trim() || "main";
    const encodedModelId = modelId
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const encodedRevision = encodeURIComponent(revision);
    const encodedFilePath = selected.rfilename
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const downloadUrl = `${this.baseUrl}/${encodedModelId}/resolve/${encodedRevision}/${encodedFilePath}`;

    return Object.freeze({
      path: selected.rfilename,
      sizeBytes: selected.lfs?.size ?? selected.size,
      sha256: selected.lfs?.sha256,
      downloadUrl,
    });
  }

  public async downloadToBuffer(url: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Hugging Face download failed with status ${response.status} for '${url}'.`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchJson<T>(pathOrUrl: string): Promise<T> {
    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${this.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(
          `Hugging Face API request failed with status ${response.status} for '${url}'.`
        ) as Error & { status?: number };

        error.status = response.status;
        throw error;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(): Headers {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("User-Agent", this.userAgent);

    if (this.authToken) {
      headers.set("Authorization", `Bearer ${this.authToken}`);
    }

    return headers;
  }

  private isHttpStatus(error: unknown, status: number): boolean {
    return !!error && typeof error === "object" && "status" in error && error.status === status;
  }
}
