import type { IncomingMessage } from "node:http";
import { resolveRequestSearchParams } from "../primitives/HttpRequestPrimitives";

export interface ResolvedWorkspaceRequestContext {
  readonly workspaceId: string;
  readonly source: "query" | "explicit";
  readonly queryParam: string;
}

export interface ResolveWorkspaceContextOptions {
  readonly workspaceId?: string;
  readonly workspaceQueryParam?: string;
  readonly missingWorkspaceMessage: string;
  readonly buildInvalidResponse(message: string): unknown;
}

export type WorkspaceContextResolution =
  | {
    readonly ok: true;
    readonly workspace: ResolvedWorkspaceRequestContext;
  }
  | {
    readonly ok: false;
    readonly statusCode: 400;
    readonly body: unknown;
  };

export function resolveWorkspaceContextFromRequest(
  request: IncomingMessage,
  options: ResolveWorkspaceContextOptions,
): WorkspaceContextResolution {
  const queryParam = normalizeOptionalString(options.workspaceQueryParam) ?? "workspaceId";
  const workspaceId = normalizeOptionalString(options.workspaceId)
    ?? normalizeOptionalString(resolveRequestSearchParams(request.url).get(queryParam));
  if (!workspaceId) {
    return Object.freeze({
      ok: false,
      statusCode: 400 as const,
      body: options.buildInvalidResponse(options.missingWorkspaceMessage),
    });
  }

  return Object.freeze({
    ok: true,
    workspace: Object.freeze({
      workspaceId,
      source: options.workspaceId ? "explicit" as const : "query" as const,
      queryParam,
    }),
  });
}

function normalizeOptionalString(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
