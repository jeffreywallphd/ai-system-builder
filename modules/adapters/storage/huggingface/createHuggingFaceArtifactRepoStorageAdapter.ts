import type { ApplicationRequestContext } from "../../../application/ports";
import type { ArtifactRepoStoragePort } from "../../../application/ports/storage";
import { createContractError, type ContractErrorCode } from "../../../contracts/shared";
import {
  createHasArtifactInRepoFailureResult,
  createHasArtifactInRepoSuccessResult,
  createRetrieveArtifactFromRepoFailureResult,
  createRetrieveArtifactFromRepoSuccessResult,
  createStoreArtifactInRepoFailureResult,
  createStoreArtifactInRepoSuccessResult,
  type ArtifactRepoTarget,
  type HasArtifactInRepoRequest,
  type RetrieveArtifactFromRepoRequest,
  type StoreArtifactInRepoRequest,
} from "../../../contracts/storage";

const HUGGING_FACE_PROVIDER = "huggingface" as const;
const DEFAULT_REVISION = "main" as const;
const DEFAULT_HUB_BASE_URL = "https://huggingface.co" as const;

type HuggingFaceRepoType = "dataset" | "model";

class HuggingFaceAdapterValidationError extends Error {}

interface ResolvedHuggingFaceTarget {
  readonly repoType: HuggingFaceRepoType;
  readonly repositoryName: string;
  readonly revision: string;
  readonly pathInRepo: string;
}

interface HuggingFaceRepoDesignation {
  type: HuggingFaceRepoType;
  name: string;
}

interface HuggingFaceHubClient {
  fileExists: (params: {
    repo: HuggingFaceRepoDesignation;
    path: string;
    revision?: string;
    accessToken?: string;
    hubUrl?: string;
    fetch?: typeof fetch;
  }) => Promise<boolean>;
  uploadFile: (params: {
    repo: HuggingFaceRepoDesignation;
    file: {
      path: string;
      content: Uint8Array;
    };
    branch?: string;
    commitTitle?: string;
    accessToken?: string;
    hubUrl?: string;
    fetch?: typeof fetch;
  }) => Promise<unknown>;
  downloadFile: (params: {
    repo: HuggingFaceRepoDesignation;
    path: string;
    revision?: string;
    accessToken?: string;
    hubUrl?: string;
    fetch?: typeof fetch;
  }) => Promise<Response>;
}

export interface CreateHuggingFaceArtifactRepoStorageAdapterOptions {
  accessToken?: string;
  fetchImplementation?: typeof fetch;
  hubBaseUrl?: string;
  defaultRepoType?: HuggingFaceRepoType;
  hubClient?: HuggingFaceHubClient;
  allowHttpFallbackWhenHubClientUnavailable?: boolean;
}

function resolveRequestContext(
  context: ApplicationRequestContext = {},
  requestContext?: { requestId?: string; correlationId?: string },
): ApplicationRequestContext {
  return {
    requestId: context.requestId ?? requestContext?.requestId,
    correlationId: context.correlationId ?? requestContext?.correlationId,
  };
}

function ensureHuggingFaceProvider(target: ArtifactRepoTarget): void {
  if (target.provider !== HUGGING_FACE_PROVIDER) {
    throw new HuggingFaceAdapterValidationError(
      `Hugging Face artifact-repo adapter requires provider \"huggingface\". Received \"${target.provider}\".`,
    );
  }
}

function normalizePathInRepo(target: ArtifactRepoTarget): string {
  const candidate = target.path?.trim();
  if (!candidate) {
    throw new HuggingFaceAdapterValidationError("Artifact-repo target.path is required for Hugging Face operations.");
  }

  if (candidate.startsWith("/")) {
    throw new HuggingFaceAdapterValidationError("Artifact-repo target.path must be repository-relative and must not start with '/'.");
  }

  const segments = candidate.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new HuggingFaceAdapterValidationError(
      "Artifact-repo target.path must not contain empty segments, '.' segments, or '..' segments.",
    );
  }

  return candidate;
}

function normalizeRepositoryParts(repository: string): { repoTypePrefix?: string; repoName: string } {
  const normalized = repository.trim();
  if (!normalized) {
    throw new HuggingFaceAdapterValidationError("Artifact-repo target.repository must be a non-empty string.");
  }

  const prefixSplit = normalized.match(/^(datasets|models)\/(.+)$/i);
  if (prefixSplit) {
    return {
      repoTypePrefix: prefixSplit[1]?.toLowerCase(),
      repoName: prefixSplit[2] ?? "",
    };
  }

  return {
    repoName: normalized,
  };
}

function resolveRepoType(
  target: ArtifactRepoTarget,
  defaultRepoType: HuggingFaceRepoType,
): { repoType: HuggingFaceRepoType; repoName: string } {
  const repositoryParts = normalizeRepositoryParts(target.repository);
  if (repositoryParts.repoTypePrefix === "datasets") {
    return {
      repoType: "dataset",
      repoName: repositoryParts.repoName,
    };
  }

  if (repositoryParts.repoTypePrefix === "models") {
    return {
      repoType: "model",
      repoName: repositoryParts.repoName,
    };
  }

  return {
    repoType: defaultRepoType,
    repoName: repositoryParts.repoName,
  };
}

function encodePathSegments(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function resolveTarget(
  target: ArtifactRepoTarget,
  defaultRepoType: HuggingFaceRepoType,
): ResolvedHuggingFaceTarget {
  ensureHuggingFaceProvider(target);

  const { repoType, repoName } = resolveRepoType(target, defaultRepoType);
  if (!repoName.includes("/")) {
    throw new HuggingFaceAdapterValidationError(
      "Artifact-repo target.repository must include namespace and repository name (for example: owner/repo).",
    );
  }

  return {
    repoType,
    repositoryName: repoName,
    revision: target.revision?.trim() || DEFAULT_REVISION,
    pathInRepo: normalizePathInRepo(target),
  };
}

function mapStatusToContractCode(status: number): ContractErrorCode {
  if (status === 400 || status === 422) {
    return "validation";
  }

  if (status === 404) {
    return "not-found";
  }

  if (status === 401 || status === 403 || status === 429 || status >= 500) {
    return "unavailable";
  }

  return "internal";
}

function extractMediaType(contentType: string | null): string | undefined {
  if (!contentType) {
    return undefined;
  }

  const normalized = contentType.split(";")[0]?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function createResolveUrl(hubBaseUrl: string, target: ResolvedHuggingFaceTarget): string {
  return `${hubBaseUrl}/${encodePathSegments(target.repositoryName)}/resolve/${encodeURIComponent(target.revision)}/${encodePathSegments(target.pathInRepo)}`;
}

function createCommitUrl(hubBaseUrl: string, target: ResolvedHuggingFaceTarget): string {
  const typeSegment = target.repoType === "dataset" ? "datasets" : "models";
  return `${hubBaseUrl}/api/${typeSegment}/${encodePathSegments(target.repositoryName)}/commit/${encodeURIComponent(target.revision)}`;
}

function createAuthHeaders(accessToken: string | undefined): Record<string, string> {
  return accessToken
    ? {
      Authorization: `Bearer ${accessToken}`,
    }
    : {};
}

function requireAccessToken(accessToken: string | undefined): string {
  const token = accessToken?.trim();
  if (!token) {
    throw new HuggingFaceAdapterValidationError(
      "Hugging Face access token is required for storeArtifactInRepo. Configure accessToken, HF_TOKEN, or HUGGING_FACE_TOKEN.",
    );
  }

  return token;
}

async function mapHttpFailure(
  operation: "hasArtifactInRepo" | "storeArtifactInRepo" | "retrieveArtifactFromRepo",
  response: Response,
): Promise<{ code: ContractErrorCode; message: string; details?: Record<string, unknown> }> {
  const responseBody = response.status >= 400 && response.status < 500
    ? (await response.text().catch(() => "")).slice(0, 300)
    : undefined;

  return {
    code: mapStatusToContractCode(response.status),
    message: `Hugging Face ${operation} failed with HTTP ${response.status}.`,
    details: responseBody
      ? {
        providerStatus: response.status,
        providerBody: responseBody,
      }
      : {
        providerStatus: response.status,
      },
  };
}

function toRepoDesignation(target: ResolvedHuggingFaceTarget): HuggingFaceRepoDesignation {
  return {
    type: target.repoType,
    name: target.repositoryName,
  };
}

async function loadOfficialHubClient(
  fetchImplementation: typeof fetch,
  hubBaseUrl: string,
): Promise<HuggingFaceHubClient> {
  const dynamicImport = new Function("return import('@huggingface/hub');") as () => Promise<unknown>;
  const loaded = await dynamicImport() as Partial<HuggingFaceHubClient>;
  if (
    typeof loaded.fileExists !== "function"
    || typeof loaded.uploadFile !== "function"
    || typeof loaded.downloadFile !== "function"
  ) {
    throw new Error("Loaded @huggingface/hub module is missing required methods.");
  }
  const fileExists = loaded.fileExists;
  const uploadFile = loaded.uploadFile;
  const downloadFile = loaded.downloadFile;

  return {
    fileExists(params) {
      return fileExists({
        ...params,
        fetch: params.fetch ?? fetchImplementation,
        hubUrl: params.hubUrl ?? hubBaseUrl,
      });
    },
    uploadFile(params) {
      return uploadFile({
        ...params,
        fetch: params.fetch ?? fetchImplementation,
        hubUrl: params.hubUrl ?? hubBaseUrl,
      });
    },
    downloadFile(params) {
      return downloadFile({
        ...params,
        fetch: params.fetch ?? fetchImplementation,
        hubUrl: params.hubUrl ?? hubBaseUrl,
      });
    },
  };
}

function createHttpFallbackHubClient(
  fetchImplementation: typeof fetch,
  hubBaseUrl: string,
): HuggingFaceHubClient {
  return {
    async fileExists(params) {
      const target: ResolvedHuggingFaceTarget = {
        repoType: params.repo.type,
        repositoryName: params.repo.name,
        revision: params.revision ?? DEFAULT_REVISION,
        pathInRepo: params.path,
      };
      const response = await fetchImplementation(createResolveUrl(hubBaseUrl, target), {
        method: "HEAD",
        headers: createAuthHeaders(params.accessToken),
      });

      if (response.ok) {
        return true;
      }

      if (response.status === 404) {
        return false;
      }

      const failure = await mapHttpFailure("hasArtifactInRepo", response);
      throw createContractError(failure.code, failure.message, {
        details: failure.details,
      });
    },
    async uploadFile(params) {
      const target: ResolvedHuggingFaceTarget = {
        repoType: params.repo.type,
        repositoryName: params.repo.name,
        revision: params.branch ?? DEFAULT_REVISION,
        pathInRepo: params.file.path,
      };
      const response = await fetchImplementation(createCommitUrl(hubBaseUrl, target), {
        method: "POST",
        headers: {
          ...createAuthHeaders(params.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: params.commitTitle ?? `Store ${params.file.path} via ai-system-builder artifact-repo adapter`,
          description: "",
          operations: [
            {
              operation: "addOrUpdate",
              pathInRepo: params.file.path,
              content: Buffer.from(params.file.content).toString("base64"),
              encoding: "base64",
            },
          ],
        }),
      });

      if (!response.ok) {
        const failure = await mapHttpFailure("storeArtifactInRepo", response);
        throw createContractError(failure.code, failure.message, {
          details: failure.details,
        });
      }
    },
    async downloadFile(params) {
      const target: ResolvedHuggingFaceTarget = {
        repoType: params.repo.type,
        repositoryName: params.repo.name,
        revision: params.revision ?? DEFAULT_REVISION,
        pathInRepo: params.path,
      };
      const response = await fetchImplementation(createResolveUrl(hubBaseUrl, target), {
        method: "GET",
        headers: createAuthHeaders(params.accessToken),
      });

      if (!response.ok) {
        const failure = await mapHttpFailure("retrieveArtifactFromRepo", response);
        throw createContractError(failure.code, failure.message, {
          details: failure.details,
        });
      }

      return response;
    },
  };
}

function mapUnexpectedHubError(
  operation: "hasArtifactInRepo" | "storeArtifactInRepo" | "retrieveArtifactFromRepo",
  error: unknown,
) {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && "message" in error
    && typeof (error as { code?: unknown }).code === "string"
  ) {
    return createContractError(
      (error as { code: ContractErrorCode }).code,
      String((error as { message?: unknown }).message ?? `Hugging Face ${operation} failed.`),
      {
        details: "details" in (error as Record<string, unknown>) && typeof (error as { details?: unknown }).details === "object"
          ? (error as { details?: Record<string, unknown> }).details
          : undefined,
      },
    );
  }

  return createContractError(
    error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal",
    `Hugging Face ${operation} failed unexpectedly.`,
    {
      details: {
        reason: error instanceof Error ? error.message : String(error),
      },
    },
  );
}

export function createHuggingFaceArtifactRepoStorageAdapter(
  options: CreateHuggingFaceArtifactRepoStorageAdapterOptions = {},
): ArtifactRepoStoragePort {
  const accessToken = options.accessToken ?? process.env.HF_TOKEN ?? process.env.HUGGING_FACE_TOKEN;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const hubBaseUrl = options.hubBaseUrl?.replace(/\/$/, "") ?? DEFAULT_HUB_BASE_URL;
  const defaultRepoType = options.defaultRepoType ?? "dataset";
  const allowHttpFallbackWhenHubClientUnavailable = options.allowHttpFallbackWhenHubClientUnavailable ?? true;
  const fallbackHubClient = createHttpFallbackHubClient(fetchImplementation, hubBaseUrl);
  const providedHubClient = options.hubClient;
  let lazyHubClientPromise: Promise<HuggingFaceHubClient> | undefined;

  async function resolveHubClient(): Promise<HuggingFaceHubClient> {
    if (providedHubClient) {
      return providedHubClient;
    }

    if (!lazyHubClientPromise) {
      lazyHubClientPromise = loadOfficialHubClient(fetchImplementation, hubBaseUrl)
        .catch((error) => {
          if (!allowHttpFallbackWhenHubClientUnavailable) {
            throw error;
          }

          return fallbackHubClient;
        });
    }

    return lazyHubClientPromise;
  }

  return {
    async hasArtifactInRepo(
      request: HasArtifactInRepoRequest,
      context: ApplicationRequestContext = {},
    ) {
      const requestContext = resolveRequestContext(context);

      try {
        const resolvedTarget = resolveTarget(request.target, defaultRepoType);
        const hubClient = await resolveHubClient();
        const exists = await hubClient.fileExists({
          repo: toRepoDesignation(resolvedTarget),
          path: resolvedTarget.pathInRepo,
          revision: resolvedTarget.revision,
          accessToken,
        });

        return createHasArtifactInRepoSuccessResult(exists, requestContext);
      } catch (error) {
        return createHasArtifactInRepoFailureResult(
          mapUnexpectedHubError("hasArtifactInRepo", error),
          requestContext,
        );
      }
    },

    async storeArtifactInRepo(
      request: StoreArtifactInRepoRequest,
      context: ApplicationRequestContext = {},
    ) {
      const requestContext = resolveRequestContext(context);

      try {
        const resolvedTarget = resolveTarget(request.target, defaultRepoType);
        const token = requireAccessToken(accessToken);
        const hubClient = await resolveHubClient();
        await hubClient.uploadFile({
          repo: toRepoDesignation(resolvedTarget),
          file: {
            path: resolvedTarget.pathInRepo,
            content: request.content,
          },
          branch: resolvedTarget.revision,
          commitTitle: `Store ${resolvedTarget.pathInRepo} via ai-system-builder artifact-repo adapter`,
          accessToken: token,
        });

        return createStoreArtifactInRepoSuccessResult(
          {
            target: request.target,
            mediaType: request.mediaType,
            sizeBytes: request.content.byteLength,
          },
          requestContext,
        );
      } catch (error) {
        return createStoreArtifactInRepoFailureResult(
          mapUnexpectedHubError("storeArtifactInRepo", error),
          requestContext,
        );
      }
    },

    async retrieveArtifactFromRepo(
      request: RetrieveArtifactFromRepoRequest,
      context: ApplicationRequestContext = {},
    ) {
      const requestContext = resolveRequestContext(context);

      try {
        const resolvedTarget = resolveTarget(request.target, defaultRepoType);
        const hubClient = await resolveHubClient();
        const response = await hubClient.downloadFile({
          repo: toRepoDesignation(resolvedTarget),
          path: resolvedTarget.pathInRepo,
          revision: resolvedTarget.revision,
          accessToken,
        });

        const bytes = new Uint8Array(await response.arrayBuffer());
        return createRetrieveArtifactFromRepoSuccessResult(
          {
            target: request.target,
            mediaType: extractMediaType(response.headers.get("content-type")),
            sizeBytes: bytes.byteLength,
          },
          bytes,
          requestContext,
        );
      } catch (error) {
        return createRetrieveArtifactFromRepoFailureResult(
          mapUnexpectedHubError("retrieveArtifactFromRepo", error),
          requestContext,
        );
      }
    },
  };
}
