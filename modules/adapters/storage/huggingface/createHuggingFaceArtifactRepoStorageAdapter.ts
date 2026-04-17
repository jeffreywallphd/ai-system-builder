import type { ApplicationRequestContext } from "../../../application/ports";
import type { ArtifactRepoStoragePort } from "../../../application/ports/storage";
import { createContractError } from "../../../contracts/shared";
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

class HuggingFaceAdapterValidationError extends Error {}

export interface CreateHuggingFaceArtifactRepoStorageAdapterOptions {
  accessToken?: string;
  fetchImplementation?: typeof fetch;
  apiBaseUrl?: string;
  resolveBaseUrl?: string;
}

function resolveRequestContext(context: ApplicationRequestContext = {}, requestContext?: {
  requestId?: string;
  correlationId?: string;
}): ApplicationRequestContext {
  return {
    requestId: context.requestId ?? requestContext?.requestId,
    correlationId: context.correlationId ?? requestContext?.correlationId,
  };
}

function ensureHuggingFaceProvider(target: ArtifactRepoTarget): void {
  if (target.provider !== HUGGING_FACE_PROVIDER) {
    throw new HuggingFaceAdapterValidationError(
      `Hugging Face artifact-repo adapter requires provider "huggingface". Received "${target.provider}".`,
    );
  }
}

function requirePath(target: ArtifactRepoTarget): string {
  const candidate = target.path?.trim();
  if (!candidate) {
    throw new HuggingFaceAdapterValidationError("Artifact-repo target.path is required for Hugging Face operations.");
  }
  return candidate;
}

function encodeRepository(repository: string): string {
  return repository
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toAuthHeaders(accessToken: string | undefined): Record<string, string> {
  if (!accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function toHeaders(options: {
  mediaType?: string;
  accessToken?: string;
  includeContentType?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    ...toAuthHeaders(options.accessToken),
  };

  if (options.includeContentType && options.mediaType) {
    headers["Content-Type"] = options.mediaType;
  }

  return headers;
}

function createResolveUrl(resolveBaseUrl: string, target: ArtifactRepoTarget, path: string): string {
  const revision = target.revision?.trim() || "main";
  return `${resolveBaseUrl}/${encodeRepository(target.repository)}/resolve/${encodeURIComponent(revision)}/${path}`;
}

function createUploadUrl(apiBaseUrl: string, target: ArtifactRepoTarget, path: string): string {
  const revision = target.revision?.trim() || "main";
  return `${apiBaseUrl}/api/datasets/${encodeRepository(target.repository)}/upload/${encodeURIComponent(revision)}/${path}`;
}

function mapHttpFailureCode(status: number): "not-found" | "unavailable" | "internal" {
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

  return contentType.split(";")[0]?.trim() || undefined;
}

export function createHuggingFaceArtifactRepoStorageAdapter(
  options: CreateHuggingFaceArtifactRepoStorageAdapterOptions = {},
): ArtifactRepoStoragePort {
  const accessToken = options.accessToken ?? process.env.HF_TOKEN ?? process.env.HUGGING_FACE_TOKEN;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const apiBaseUrl = options.apiBaseUrl?.replace(/\/$/, "") ?? "https://huggingface.co";
  const resolveBaseUrl = options.resolveBaseUrl?.replace(/\/$/, "") ?? "https://huggingface.co";

  return {
    async hasArtifactInRepo(
      request: HasArtifactInRepoRequest,
      context: ApplicationRequestContext = {},
    ) {
      const requestContext = resolveRequestContext(context);
      try {
        ensureHuggingFaceProvider(request.target);
        const repoPath = requirePath(request.target);
        const url = createResolveUrl(resolveBaseUrl, request.target, repoPath);

        const response = await fetchImplementation(url, {
          method: "HEAD",
          headers: toHeaders({ accessToken }),
        });

        if (response.ok) {
          return createHasArtifactInRepoSuccessResult(true, {
            descriptor: {
              target: request.target,
              mediaType: extractMediaType(response.headers.get("content-type")),
              sizeBytes: Number(response.headers.get("content-length") ?? "0") || undefined,
            },
            ...requestContext,
          });
        }

        if (response.status === 404) {
          return createHasArtifactInRepoSuccessResult(false, requestContext);
        }

        return createHasArtifactInRepoFailureResult(
          createContractError(
            mapHttpFailureCode(response.status),
            `Hugging Face hasArtifactInRepo failed with HTTP ${response.status}.`,
          ),
          requestContext,
        );
      } catch (error) {
        const code = error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal";
        return createHasArtifactInRepoFailureResult(
          createContractError(code, "Hugging Face hasArtifactInRepo failed unexpectedly.", {
            details: {
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
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
        ensureHuggingFaceProvider(request.target);
        const repoPath = requirePath(request.target);
        const uploadUrl = createUploadUrl(apiBaseUrl, request.target, repoPath);

        const uploadResponse = await fetchImplementation(uploadUrl, {
          method: "PUT",
          headers: toHeaders({
            accessToken,
            mediaType: request.mediaType,
            includeContentType: true,
          }),
          body: request.content,
        });

        if (!uploadResponse.ok) {
          return createStoreArtifactInRepoFailureResult(
            createContractError(
              mapHttpFailureCode(uploadResponse.status),
              `Hugging Face storeArtifactInRepo failed with HTTP ${uploadResponse.status}.`,
            ),
            requestContext,
          );
        }

        return createStoreArtifactInRepoSuccessResult(
          {
            target: request.target,
            mediaType: request.mediaType,
            sizeBytes: request.content.byteLength,
          },
          requestContext,
        );
      } catch (error) {
        const code = error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal";
        return createStoreArtifactInRepoFailureResult(
          createContractError(code, "Hugging Face storeArtifactInRepo failed unexpectedly.", {
            details: {
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
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
        ensureHuggingFaceProvider(request.target);
        const repoPath = requirePath(request.target);
        const url = createResolveUrl(resolveBaseUrl, request.target, repoPath);

        const response = await fetchImplementation(url, {
          method: "GET",
          headers: toHeaders({ accessToken }),
        });

        if (!response.ok) {
          return createRetrieveArtifactFromRepoFailureResult(
            createContractError(
              mapHttpFailureCode(response.status),
              `Hugging Face retrieveArtifactFromRepo failed with HTTP ${response.status}.`,
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
        const code = error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal";
        return createRetrieveArtifactFromRepoFailureResult(
          createContractError(code, "Hugging Face retrieveArtifactFromRepo failed unexpectedly.", {
            details: {
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
          requestContext,
        );
      }
    },
  };
}
