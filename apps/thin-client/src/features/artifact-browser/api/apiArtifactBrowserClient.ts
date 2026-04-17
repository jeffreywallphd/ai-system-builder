export interface ArtifactBrowserLocator {
  storageKey: string;
}

export interface ThinClientArtifactBrowseItem {
  storageKey: string;
  artifactKind: "image";
  mediaType?: string;
  sizeBytes?: number;
  originalName?: string;
  createdAt?: string;
}

export interface ThinClientArtifactDetail {
  locator: ArtifactBrowserLocator;
  artifactKind: "image";
  mediaType?: string;
  sizeBytes?: number;
  originalName?: string;
  createdAt?: string;
  metadata?: {
    publishedBacking?: Omit<ThinClientPublishedBacking, "exists">;
  };
}

export interface ThinClientArtifactContentDescriptor {
  locator: ArtifactBrowserLocator;
  mediaType?: string;
  sizeBytes?: number;
  availability: "available" | "unavailable";
  retrieval: "inline" | "deferred";
}

export interface ThinClientPublishedBacking {
  provider: string;
  repository: string;
  path: string;
  revision?: string;
  exists: boolean;
}

export interface ArtifactBrowserApiClient {
  browseImageArtifacts: () => Promise<ThinClientArtifactBrowseItem[]>;
  readArtifactDetail: (locator: ArtifactBrowserLocator) => Promise<ThinClientArtifactDetail>;
  readArtifactContent: (locator: ArtifactBrowserLocator) => Promise<ThinClientArtifactContentDescriptor>;
  createArtifactMediaViewUrl: (locator: ArtifactBrowserLocator) => string;
  publishArtifactToHuggingFace: (input: {
    artifactId: string;
    repository: string;
    path: string;
    revision?: string;
    mediaType?: string;
  }) => Promise<ThinClientPublishedBacking>;
}

interface ApiResponseEnvelope {
  ok: boolean;
  value?: unknown;
  error?: {
    message?: string;
  };
}

function createApiUrl(apiBaseUrl: string, suffix: string): string {
  return `${apiBaseUrl.trim().replace(/\/+$/, "") || "/api"}${suffix}`;
}

function ensureEnvelope(value: unknown): ApiResponseEnvelope {
  if (typeof value === "object" && value !== null && "ok" in value) {
    return value as ApiResponseEnvelope;
  }

  throw new Error("Artifact browser response is not a valid API envelope.");
}

function ensureSuccess<T>(response: ApiResponseEnvelope, pick: (value: unknown) => T): T {
  if (!response.ok) {
    throw new Error(response.error?.message ?? "Artifact browser request failed.");
  }

  return pick(response.value);
}

export interface CreateApiArtifactBrowserClientOptions {
  apiBaseUrl?: string;
  source?: string;
}

export function createApiArtifactBrowserClient(
  options: CreateApiArtifactBrowserClientOptions = {},
): ArtifactBrowserApiClient {
  const apiBaseUrl = options.apiBaseUrl ?? "/api";
  const source = options.source ?? "thin-client.artifact-browser";

  return {
    async browseImageArtifacts(): Promise<ThinClientArtifactBrowseItem[]> {
      const response = await fetch(createApiUrl(apiBaseUrl, "/artifact/browse"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ artifactKind: "image", source }),
      });

      const envelope = ensureEnvelope((await response.json()) as unknown);
      return ensureSuccess(envelope, (value) => {
        const items = (value as { items?: ThinClientArtifactBrowseItem[] } | undefined)?.items;
        return Array.isArray(items) ? items : [];
      });
    },

    async readArtifactDetail(locator: ArtifactBrowserLocator): Promise<ThinClientArtifactDetail> {
      const response = await fetch(createApiUrl(apiBaseUrl, "/artifact/read"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ locator, source }),
      });

      const envelope = ensureEnvelope((await response.json()) as unknown);
      return ensureSuccess(envelope, (value) => {
        const artifact = (value as { artifact?: ThinClientArtifactDetail } | undefined)?.artifact;
        if (!artifact) {
          throw new Error("Artifact read response is missing artifact detail.");
        }

        return artifact;
      });
    },

    async readArtifactContent(
      locator: ArtifactBrowserLocator,
    ): Promise<ThinClientArtifactContentDescriptor> {
      const response = await fetch(createApiUrl(apiBaseUrl, "/artifact/content/read"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ locator, source }),
      });

      const envelope = ensureEnvelope((await response.json()) as unknown);
      return ensureSuccess(envelope, (value) => {
        const content = (value as { content?: ThinClientArtifactContentDescriptor } | undefined)?.content;
        if (!content) {
          throw new Error("Artifact content-read response is missing descriptor content.");
        }

        return content;
      });
    },

    createArtifactMediaViewUrl(locator: ArtifactBrowserLocator): string {
      const query = new URLSearchParams({ storageKey: locator.storageKey });
      return createApiUrl(apiBaseUrl, `/artifact/media/view?${query.toString()}`);
    },

    async publishArtifactToHuggingFace(input): Promise<ThinClientPublishedBacking> {
      const response = await fetch(createApiUrl(apiBaseUrl, "/artifact/publish"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          artifactId: input.artifactId,
          target: {
            provider: "huggingface",
            repository: input.repository,
            revision: input.revision,
            path: input.path,
          },
          mediaType: input.mediaType,
          verify: true,
          source,
        }),
      });

      const envelope = ensureEnvelope((await response.json()) as unknown);
      return ensureSuccess(envelope, (value) => {
        const backing = value as ThinClientPublishedBacking;
        if (!backing || typeof backing !== "object") {
          throw new Error("Artifact publish response is missing backing information.");
        }

        return backing;
      });
    },
  };
}
