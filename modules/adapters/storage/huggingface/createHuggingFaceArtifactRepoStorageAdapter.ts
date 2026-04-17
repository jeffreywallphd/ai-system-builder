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

export interface CreateHuggingFaceArtifactRepoStorageAdapterOptions {
  accessToken?: string;
  fetchImplementation?: typeof fetch;
  hubBaseUrl?: string;
  defaultRepoType?: HuggingFaceRepoType;
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

export function createHuggingFaceArtifactRepoStorageAdapter(
  options: CreateHuggingFaceArtifactRepoStorageAdapterOptions = {},
): ArtifactRepoStoragePort {
  const accessToken = options.accessToken ?? process.env.HF_TOKEN ?? process.env.HUGGING_FACE_TOKEN;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const hubBaseUrl = options.hubBaseUrl?.replace(/\/$/, "") ?? DEFAULT_HUB_BASE_URL;
  const defaultRepoType = options.defaultRepoType ?? "dataset";

  return {
    async hasArtifactInRepo(
      request: HasArtifactInRepoRequest,
      context: ApplicationRequestContext = {},
    ) {
      const requestContext = resolveRequestContext(context);

      try {
        const resolvedTarget = resolveTarget(request.target, defaultRepoType);
        const response = await fetchImplementation(createResolveUrl(hubBaseUrl, resolvedTarget), {
          method: "HEAD",
          headers: createAuthHeaders(accessToken),
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

        const failure = await mapHttpFailure("hasArtifactInRepo", response);
        return createHasArtifactInRepoFailureResult(
          createContractError(failure.code, failure.message, {
            details: failure.details,
          }),
          requestContext,
        );
      } catch (error) {
        return createHasArtifactInRepoFailureResult(
          createContractError(
            error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal",
            "Hugging Face hasArtifactInRepo failed unexpectedly.",
            {
              details: {
                reason: error instanceof Error ? error.message : String(error),
              },
            },
          ),
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
        const commitPayload = {
          summary: `Store ${resolvedTarget.pathInRepo} via ai-system-builder artifact-repo adapter`,
          description: "",
          operations: [
            {
              operation: "addOrUpdate",
              pathInRepo: resolvedTarget.pathInRepo,
              content: Buffer.from(request.content).toString("base64"),
              encoding: "base64",
            },
          ],
        };

        const response = await fetchImplementation(createCommitUrl(hubBaseUrl, resolvedTarget), {
          method: "POST",
          headers: {
            ...createAuthHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(commitPayload),
        });

        if (!response.ok) {
          const failure = await mapHttpFailure("storeArtifactInRepo", response);
          return createStoreArtifactInRepoFailureResult(
            createContractError(failure.code, failure.message, {
              details: failure.details,
            }),
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
        return createStoreArtifactInRepoFailureResult(
          createContractError(
            error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal",
            "Hugging Face storeArtifactInRepo failed unexpectedly.",
            {
              details: {
                reason: error instanceof Error ? error.message : String(error),
              },
            },
          ),
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
        const response = await fetchImplementation(createResolveUrl(hubBaseUrl, resolvedTarget), {
          method: "GET",
          headers: createAuthHeaders(accessToken),
        });

        if (!response.ok) {
          const failure = await mapHttpFailure("retrieveArtifactFromRepo", response);
          return createRetrieveArtifactFromRepoFailureResult(
            createContractError(failure.code, failure.message, {
              details: failure.details,
            }),
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
          createContractError(
            error instanceof HuggingFaceAdapterValidationError ? "validation" : "internal",
            "Hugging Face retrieveArtifactFromRepo failed unexpectedly.",
            {
              details: {
                reason: error instanceof Error ? error.message : String(error),
              },
            },
          ),
          requestContext,
        );
      }
    },
  };
}
