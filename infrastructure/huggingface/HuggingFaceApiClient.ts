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

function buildDownloadUrl(baseUrl: string, modelId: string, revision: string, filePath: string): string {
  const encodedModelId = modelId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const encodedRevision = encodeURIComponent(revision);
  const encodedFilePath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${baseUrl}/${encodedModelId}/resolve/${encodedRevision}/${encodedFilePath}`;
}

export class HuggingFaceApiClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private hubModulePromise?: Promise<IHuggingFaceHubModule | undefined>;

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
    const hubModule = await this.loadHubModule();

    if (hubModule?.listModels) {
      try {
        return await this.searchModelsWithHubModule(hubModule, params);
      } catch {
        // If the hub module cannot satisfy the request (version mismatch, unsupported
        // options, etc.), gracefully fall back to the direct HTTP API implementation.
      }
    }

    return this.searchModelsWithHttpApi(params);
  }

  private async searchModelsWithHttpApi(params: {
    readonly query?: string;
    readonly limit?: number;
    readonly cursor?: string;
    readonly pipelineTag?: string;
    readonly author?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly full?: boolean;
    readonly gated?: boolean;
  }): Promise<ReadonlyArray<IHuggingFaceModelSearchItem>> {
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

  private async searchModelsWithHubModule(
    hubModule: IHuggingFaceHubModule,
    params: {
      readonly query?: string;
      readonly limit?: number;
      readonly cursor?: string;
      readonly pipelineTag?: string;
      readonly author?: string;
      readonly tags?: ReadonlyArray<string>;
      readonly full?: boolean;
      readonly gated?: boolean;
    }
  ): Promise<ReadonlyArray<IHuggingFaceModelSearchItem>> {
    const items: IHuggingFaceModelSearchItem[] = [];

    const iterator = hubModule.listModels({
      search: params.query?.trim() || undefined,
      limit: params.limit,
      author: params.author?.trim() || undefined,
      task: params.pipelineTag?.trim() || undefined,
      filter: params.tags && params.tags.length > 0 ? [...params.tags] : undefined,
      full: params.full ?? true,
      gated: params.gated,
      accessToken: this.authToken,
    });

    for await (const model of iterator) {
      items.push(model as IHuggingFaceModelSearchItem);
    }

    return Object.freeze(items);
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

  public async listModelFiles(params: {
    readonly modelId: string;
    readonly revision?: string;
  }): Promise<ReadonlyArray<IHuggingFaceModelFileInfo>> {
    const modelId = params.modelId.trim();

    if (!modelId) {
      throw new Error("HuggingFaceApiClient.listModelFiles requires a non-empty modelId.");
    }

    const info = await this.getModelInfo(modelId);

    if (!info) {
      return Object.freeze([]);
    }

    const revision = params.revision?.trim() || info.sha || "main";
    const hubModule = await this.loadHubModule();

    if (hubModule?.listFiles) {
      try {
        const files = await this.listModelFilesWithHubModule(hubModule, {
          modelId,
          revision,
        });

        if (files.length > 0) {
          return files;
        }
      } catch {
        // Fall back to the direct API response when the installed hub package cannot
        // enumerate files for this repository/version.
      }
    }

    return Object.freeze(
      (info.siblings ?? [])
        .filter((sibling) => !!sibling.rfilename)
        .map((sibling) =>
          Object.freeze({
            path: sibling.rfilename!,
            sizeBytes: sibling.lfs?.size ?? sibling.size,
            sha256: sibling.lfs?.sha256,
            downloadUrl: buildDownloadUrl(this.baseUrl, modelId, revision, sibling.rfilename!),
          })
        )
    );
  }

  private async listModelFilesWithHubModule(
    hubModule: IHuggingFaceHubModule,
    params: {
      readonly modelId: string;
      readonly revision: string;
    }
  ): Promise<ReadonlyArray<IHuggingFaceModelFileInfo>> {
    const files: IHuggingFaceModelFileInfo[] = [];

    const iterator = hubModule.listFiles({
      repo: {
        type: "model",
        name: params.modelId,
      },
      revision: params.revision,
      recursive: true,
      expand: true,
      accessToken: this.authToken,
    });

    for await (const entry of iterator) {
      if (!entry || entry.type !== "file" || !entry.path?.trim()) {
        continue;
      }

      files.push(
        Object.freeze({
          path: entry.path,
          sizeBytes: entry.lfs?.size ?? entry.size,
          sha256: entry.lfs?.oid,
          downloadUrl: buildDownloadUrl(this.baseUrl, params.modelId, params.revision, entry.path),
        })
      );
    }

    return Object.freeze(files);
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

    const files = await this.listModelFiles({
      modelId,
      revision: params.revision,
    });

    if (files.length === 0) {
      return undefined;
    }

    const preferredExtensions = (params.preferredExtensions ?? []).map((value) =>
      value.trim().toLowerCase()
    );
    const preferredFileNames = (params.preferredFileNames ?? []).map((value) =>
      value.trim().toLowerCase()
    );

    const scored = files
      .map((file) => {
        const lower = file.path.toLowerCase();

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
          file,
          score,
        };
      })
      .sort((left, right) => right.score - left.score);

    return scored[0]?.file;
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

  private async loadHubModule(): Promise<IHuggingFaceHubModule | undefined> {
    if (!this.hubModulePromise) {
      this.hubModulePromise = (async () => {
        try {
          const moduleName = "@huggingface/hub";
          const hubModule = (await import(/* @vite-ignore */ moduleName)) as Partial<IHuggingFaceHubModule>;

          if (typeof hubModule.listModels === "function" && typeof hubModule.listFiles === "function") {
            return {
              listModels: hubModule.listModels,
              listFiles: hubModule.listFiles,
            };
          }

          return undefined;
        } catch {
          return undefined;
        }
      })();
    }

    return this.hubModulePromise;
  }

  private isHttpStatus(error: unknown, status: number): boolean {
    return !!error && typeof error === "object" && "status" in error && error.status === status;
  }
}

interface IHuggingFaceHubModule {
  readonly listModels: (params: Readonly<Record<string, unknown>>) => AsyncIterable<unknown>;
  readonly listFiles: (params: Readonly<Record<string, unknown>>) => AsyncIterable<{
    readonly type?: string;
    readonly size?: number;
    readonly path?: string;
    readonly lfs?: {
      readonly oid?: string;
      readonly size?: number;
    };
  }>;
}
