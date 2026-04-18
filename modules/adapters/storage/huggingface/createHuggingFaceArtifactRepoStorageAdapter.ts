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
class HuggingFaceHubClientUnavailableError extends Error {}

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

type HuggingFaceOperation =
  | "hasArtifactInRepo"
  | "storeArtifactInRepo"
  | "retrieveArtifactFromRepo";

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
  officialHubClientLoader?: (
    fetchImplementation: typeof fetch,
    hubBaseUrl: string,
  ) => Promise<HuggingFaceHubClient>;
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProviderStatusCode(error: unknown): number | undefined {
  if (!isObjectRecord(error)) {
    return undefined;
  }

  const statusCode = error.statusCode;
  if (typeof statusCode === "number") {
    return statusCode;
  }

  const status = error.status;
  if (typeof status === "number") {
    return status;
  }

  return undefined;
}

function getProviderErrorReason(error: unknown): string | undefined {
  if (!isObjectRecord(error)) {
    return undefined;
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error.error === "string" && error.error.trim().length > 0) {
    return error.error;
  }

  return undefined;
}

function createAuthRequiredError(operation: HuggingFaceOperation): ReturnType<typeof createContractError> {
  return createContractError(
    "unavailable",
    `Hugging Face ${operation} requires authentication, but no access token is configured.`,
    {
      details: {
        provider: HUGGING_FACE_PROVIDER,
        authIssue: "missing-token",
        guidance: "Configure HF_TOKEN or HUGGING_FACE_TOKEN in the host/server environment.",
      },
    },
  );
}

function mapProviderStatusError(
  operation: HuggingFaceOperation,
  statusCode: number,
  accessToken: string | undefined,
  reason: string | undefined,
) {
  if (statusCode === 401 || statusCode === 403) {
    const tokenMissing = !accessToken?.trim();
    const message = tokenMissing
      ? `Hugging Face ${operation} requires an access token for this repository. No token is configured.`
      : `Hugging Face ${operation} failed authentication (token invalid/insufficient or repository access denied).`;

    return createContractError(
      "unavailable",
      message,
      {
        details: {
          provider: HUGGING_FACE_PROVIDER,
          providerStatus: statusCode,
          authIssue: tokenMissing ? "missing-token" : "invalid-token-or-access-denied",
          reason,
          guidance: tokenMissing
            ? "Configure HF_TOKEN or HUGGING_FACE_TOKEN in the host/server environment."
            : "Verify the configured Hugging Face token and repository permissions (private/gated access).",
        },
      },
    );
  }

  return createContractError(
    mapStatusToContractCode(statusCode),
    `Hugging Face ${operation} failed with provider status ${statusCode}.`,
    {
      details: {
        providerStatus: statusCode,
        reason,
      },
    },
  );
}

function extractMediaType(contentType: string | null): string | undefined {
  if (!contentType) {
    return undefined;
  }

  const normalized = contentType.split(";")[0]?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toRepoDesignation(target: ResolvedHuggingFaceTarget): HuggingFaceRepoDesignation {
  return {
    type: target.repoType,
    name: target.repositoryName,
  };
}

function assertHubClient(client: Partial<HuggingFaceHubClient>): HuggingFaceHubClient {
  if (
    typeof client.fileExists !== "function"
    || typeof client.uploadFile !== "function"
    || typeof client.downloadFile !== "function"
  ) {
    throw new HuggingFaceHubClientUnavailableError(
      "The @huggingface/hub client is unavailable or missing required methods (fileExists/uploadFile/downloadFile).",
    );
  }

  return client as HuggingFaceHubClient;
}

async function loadOfficialHubClient(
  fetchImplementation: typeof fetch,
  hubBaseUrl: string,
): Promise<HuggingFaceHubClient> {
  const dynamicImport = new Function("return import('@huggingface/hub');") as () => Promise<unknown>;
  const loaded = await dynamicImport() as Partial<HuggingFaceHubClient>;
  const hubClient = assertHubClient(loaded);

  return {
    fileExists(params) {
      return hubClient.fileExists({
        ...params,
        fetch: params.fetch ?? fetchImplementation,
        hubUrl: params.hubUrl ?? hubBaseUrl,
      });
    },
    uploadFile(params) {
      return hubClient.uploadFile({
        ...params,
        fetch: params.fetch ?? fetchImplementation,
        hubUrl: params.hubUrl ?? hubBaseUrl,
      });
    },
    downloadFile(params) {
      return hubClient.downloadFile({
        ...params,
        fetch: params.fetch ?? fetchImplementation,
        hubUrl: params.hubUrl ?? hubBaseUrl,
      });
    },
  };
}

function mapUnexpectedHubError(
  operation: HuggingFaceOperation,
  error: unknown,
  accessToken: string | undefined,
) {
  if (error instanceof HuggingFaceHubClientUnavailableError) {
    return createContractError("unavailable", error.message, {
      details: {
        reason: error.message,
      },
    });
  }

  if (error instanceof HuggingFaceAdapterValidationError) {
    return createContractError("validation", `Hugging Face ${operation} failed unexpectedly.`, {
      details: {
        reason: error.message,
      },
    });
  }

  const providerStatus = getProviderStatusCode(error);
  if (providerStatus !== undefined) {
    return mapProviderStatusError(
      operation,
      providerStatus,
      accessToken,
      getProviderErrorReason(error),
    );
  }

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

  return createContractError("internal", `Hugging Face ${operation} failed unexpectedly.`, {
    details: {
      reason: error instanceof Error ? error.message : String(error),
    },
  });
}

export function createHuggingFaceArtifactRepoStorageAdapter(
  options: CreateHuggingFaceArtifactRepoStorageAdapterOptions = {},
): ArtifactRepoStoragePort {
  const accessToken = options.accessToken ?? process.env.HF_TOKEN ?? process.env.HUGGING_FACE_TOKEN;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const hubBaseUrl = options.hubBaseUrl?.replace(/\/$/, "") ?? DEFAULT_HUB_BASE_URL;
  const defaultRepoType = options.defaultRepoType ?? "dataset";
  const providedHubClient = options.hubClient;
  const officialHubClientLoader = options.officialHubClientLoader ?? loadOfficialHubClient;
  let lazyHubClientPromise: Promise<HuggingFaceHubClient> | undefined;

  async function resolveHubClient(): Promise<HuggingFaceHubClient> {
    if (providedHubClient) {
      return assertHubClient(providedHubClient);
    }

    if (!lazyHubClientPromise) {
      lazyHubClientPromise = officialHubClientLoader(fetchImplementation, hubBaseUrl)
        .catch((error) => {
          throw new HuggingFaceHubClientUnavailableError(
            `Failed to initialize @huggingface/hub client: ${error instanceof Error ? error.message : String(error)}.`,
          );
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
          mapUnexpectedHubError("hasArtifactInRepo", error, accessToken),
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
        const token = accessToken?.trim();
        if (!token) {
          return createStoreArtifactInRepoFailureResult(
            createAuthRequiredError("storeArtifactInRepo"),
            requestContext,
          );
        }
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
          mapUnexpectedHubError("storeArtifactInRepo", error, accessToken),
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
        if (!response.ok) {
          return createRetrieveArtifactFromRepoFailureResult(
            mapProviderStatusError(
              "retrieveArtifactFromRepo",
              response.status,
              accessToken,
              response.statusText,
            ),
            requestContext,
          );
        }

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
          mapUnexpectedHubError("retrieveArtifactFromRepo", error, accessToken),
          requestContext,
        );
      }
    },
  };
}
