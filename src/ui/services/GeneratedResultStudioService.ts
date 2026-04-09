import {
  buildGeneratedResultByRunRoutePath,
  buildGeneratedResultLineageDetailRoutePath,
  buildGeneratedResultPreviewRoutePath,
  buildGeneratedResultRoutePath,
  GeneratedResultTransportContractVersions,
  toListGeneratedResultsByRunQueryParams,
  toListGeneratedResultsQueryParams,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";
import type {
  GeneratedResultManagementApiError,
  GeneratedResultManagementApiResponse,
  GetGeneratedResultApiResponse,
  GetGeneratedResultLineageDetailApiResponse,
  ListGeneratedResultsApiResponse,
  ListGeneratedResultsByRunApiResponse,
  RequestGeneratedResultPreviewApiResponse,
} from "@infrastructure/api/generated-results/sdk/PublicGeneratedResultManagementApiContract";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class GeneratedResultStudioService {
  private readonly baseUrl: string;

  public constructor(baseUrl: string = resolveGeneratedResultApiBaseUrl()) {
    this.baseUrl = baseUrl;
  }

  public async listGeneratedResults(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly workflowId?: string;
    readonly runId?: string;
    readonly limit?: number;
    readonly offset?: number;
    readonly sessionToken: string;
  }): Promise<GeneratedResultManagementApiResponse<ListGeneratedResultsApiResponse>> {
    const query = toListGeneratedResultsQueryParams({
      contractVersion: GeneratedResultTransportContractVersions.v1,
      actorUserId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      runId: input.runId,
      limit: input.limit,
      offset: input.offset,
    });

    return this.requestJson<ListGeneratedResultsApiResponse>("GET", `/api/v1/generated-results?${query.toString()}`, input.sessionToken);
  }

  public async getGeneratedResult(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly resultAssetId: string;
    readonly sessionToken: string;
  }): Promise<GeneratedResultManagementApiResponse<GetGeneratedResultApiResponse>> {
    const path = buildGeneratedResultRoutePath({
      resultAssetId: input.resultAssetId,
    });
    return this.requestJson<GetGeneratedResultApiResponse>(
      "GET",
      `${path}?workspaceId=${encodeURIComponent(input.workspaceId)}`,
      input.sessionToken,
    );
  }

  public async listGeneratedResultsByRun(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly runId: string;
    readonly limit?: number;
    readonly offset?: number;
    readonly sessionToken: string;
  }): Promise<GeneratedResultManagementApiResponse<ListGeneratedResultsByRunApiResponse>> {
    const path = buildGeneratedResultByRunRoutePath({
      runId: input.runId,
    });
    const query = toListGeneratedResultsByRunQueryParams({
      contractVersion: GeneratedResultTransportContractVersions.v1,
      actorUserId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      limit: input.limit,
      offset: input.offset,
    });
    return this.requestJson<ListGeneratedResultsByRunApiResponse>("GET", `${path}?${query.toString()}`, input.sessionToken);
  }

  public async requestGeneratedResultPreview(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly resultAssetId: string;
    readonly sessionToken: string;
  }): Promise<GeneratedResultManagementApiResponse<RequestGeneratedResultPreviewApiResponse>> {
    const path = buildGeneratedResultPreviewRoutePath({
      resultAssetId: input.resultAssetId,
    });
    return this.requestJson<RequestGeneratedResultPreviewApiResponse>(
      "GET",
      `${path}?workspaceId=${encodeURIComponent(input.workspaceId)}`,
      input.sessionToken,
    );
  }

  public async getGeneratedResultLineageDetail(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly resultAssetId: string;
    readonly sessionToken: string;
  }): Promise<GeneratedResultManagementApiResponse<GetGeneratedResultLineageDetailApiResponse>> {
    const path = buildGeneratedResultLineageDetailRoutePath({
      resultAssetId: input.resultAssetId,
    });
    return this.requestJson<GetGeneratedResultLineageDetailApiResponse>(
      "GET",
      `${path}?workspaceId=${encodeURIComponent(input.workspaceId)}`,
      input.sessionToken,
    );
  }

  public async getGeneratedResultOriginalContent(input: {
    readonly workspaceId: string;
    readonly resultAssetId: string;
    readonly sessionToken: string;
  }): Promise<GeneratedResultManagementApiResponse<{
    readonly resultAssetId: string;
    readonly fileName: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly payloadBase64: string;
  }>> {
    const path = buildGeneratedResultRoutePath({
      resultAssetId: input.resultAssetId,
    }).replace(/\/$/, "");
    const originalPath = `${path}/original`;
    const response = await fetch(`${this.baseUrl}${originalPath}?workspaceId=${encodeURIComponent(input.workspaceId)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.sessionToken}`,
      },
    });

    if (!response.ok) {
      try {
        return await response.json() as GeneratedResultManagementApiResponse<{
          readonly resultAssetId: string;
          readonly fileName: string;
          readonly mimeType: string;
          readonly sizeBytes: number;
          readonly payloadBase64: string;
        }>;
      } catch {
        return {
          ok: false,
          error: {
            code: "internal",
            message: "Generated-result original content could not be loaded.",
          },
        };
      }
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const fileName = parseContentDispositionFileName(response.headers.get("content-disposition"))
      ?? `generated-result-${input.resultAssetId}.png`;
    return {
      ok: true,
      data: {
        resultAssetId: input.resultAssetId,
        fileName,
        mimeType,
        sizeBytes: bytes.byteLength,
        payloadBase64: encodeBytesToBase64(bytes),
      },
    };
  }

  private async requestJson<TResponse>(
    method: "GET",
    path: string,
    sessionToken: string,
  ): Promise<GeneratedResultManagementApiResponse<TResponse>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    try {
      return await response.json() as GeneratedResultManagementApiResponse<TResponse>;
    } catch {
      return {
        ok: false,
        error: Object.freeze({
          code: "internal",
          message: "Generated-result response could not be parsed.",
        } satisfies GeneratedResultManagementApiError),
      };
    }
  }
}

function resolveGeneratedResultApiBaseUrl(): string {
  return resolveDesktopIdentityApiBaseUrl() ?? resolveWebIdentityApiBaseUrl();
}

function parseContentDispositionFileName(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const quoted = /filename="([^"]+)"/i.exec(value);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const unquoted = /filename=([^;]+)/i.exec(value);
  return unquoted?.[1]?.trim();
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
