import type { IncomingMessage } from "node:http";
import {
  AuthorizationContextResolutionReasonCodes,
  AuthorizationDiagnosticMatchedSourceKinds,
  AuthorizationDiagnosticOutcomes,
  AuthorizationDiagnosticProvenanceStages,
  AuthorizationDiagnosticTargetKinds,
  createAuthorizationDiagnosticRecord,
  type AuthorizationDiagnosticRecord,
  type AuthorizationDiagnosticReasonCode,
} from "@shared/contracts/authorization/AuthorizationDiagnosticsContracts";

export interface AuthorizationRequestContextHints {
  readonly method: string;
  readonly path: string;
  readonly requestFamily: string;
  readonly operationName: string;
  readonly targetHint: string;
  readonly workspaceHintState: "resolved" | "unresolved" | "ambiguous";
  readonly workspaceHint?: string;
  readonly workspaceHintCount: number;
}

export interface AuthorizationContextSnapshotDiagnosticInput {
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorIdentityId?: string;
  readonly actorActiveWorkspaceId?: string;
  readonly hints: AuthorizationRequestContextHints;
  readonly reasonCode: AuthorizationDiagnosticReasonCode;
  readonly outcome: typeof AuthorizationDiagnosticOutcomes.observed | typeof AuthorizationDiagnosticOutcomes.deny;
}

const CanonicalWorkspaceHintQueryKeys = Object.freeze([
  "workspaceId",
  "targetWorkspaceId",
  "actorWorkspaceId",
] as const);

export function resolveAuthorizationRequestContextHints(
  request: IncomingMessage,
): AuthorizationRequestContextHints {
  const path = resolveCanonicalRequestPath(request.url);
  const method = (request.method ?? "UNKNOWN").toUpperCase();
  const requestFamily = resolveRequestFamily(path);
  const workspaceHints = resolveWorkspaceHintValues(request.url);
  const workspaceHint = workspaceHints[0];

  return Object.freeze({
    method,
    path,
    requestFamily,
    operationName: `${method} ${path}`,
    targetHint: `${method}:${path}`,
    workspaceHintState: workspaceHints.length === 0
      ? "unresolved"
      : workspaceHints.length === 1
        ? "resolved"
        : "ambiguous",
    workspaceHint,
    workspaceHintCount: workspaceHints.length,
  });
}

export function buildAuthorizationContextSnapshotDiagnostic(
  input: AuthorizationContextSnapshotDiagnosticInput,
): AuthorizationDiagnosticRecord {
  return createAuthorizationDiagnosticRecord({
    outcome: input.outcome,
    correlation: Object.freeze({
      requestId: input.requestId,
      correlationId: input.correlationId,
    }),
    actor: Object.freeze({
      actorIdentityId: input.actorIdentityId,
      actorActiveWorkspaceId: input.actorActiveWorkspaceId,
    }),
    target: Object.freeze({
      kind: AuthorizationDiagnosticTargetKinds.unresolved,
      targetIdentifier: input.hints.targetHint,
      targetWorkspaceId: input.actorActiveWorkspaceId ?? input.hints.workspaceHint,
      targetResourceType: input.hints.requestFamily,
    }),
    matchedSourceKind: input.outcome === AuthorizationDiagnosticOutcomes.deny
      ? AuthorizationDiagnosticMatchedSourceKinds.notEvaluated
      : undefined,
    reasonCode: input.reasonCode,
    denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.actorSnapshot,
    extensions: Object.freeze({
      "identity.request-family": input.hints.requestFamily,
      "identity.operation-name": input.hints.operationName,
      "identity.workspace-hint-state": input.hints.workspaceHintState,
      "identity.workspace-hint-count": input.hints.workspaceHintCount,
      "identity.workspace-hint": input.hints.workspaceHint,
    }),
  });
}

export function resolveAuthorizationContextSnapshotReasonCode(input: {
  readonly workspaceResolved: boolean;
  readonly workspaceAmbiguous: boolean;
}): AuthorizationDiagnosticReasonCode {
  if (input.workspaceResolved) {
    return AuthorizationContextResolutionReasonCodes.workspaceContextResolved;
  }
  if (input.workspaceAmbiguous) {
    return AuthorizationContextResolutionReasonCodes.workspaceContextAmbiguous;
  }
  return AuthorizationContextResolutionReasonCodes.contextSnapshotCaptured;
}

function resolveCanonicalRequestPath(requestUrl: string | undefined): string {
  try {
    return new URL(requestUrl ?? "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function resolveRequestFamily(path: string): string {
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments[0] === "api" && segments[1] === "v1") {
    return segments[2] ?? "unknown";
  }
  return segments[0] ?? "unknown";
}

function resolveWorkspaceHintValues(requestUrl: string | undefined): ReadonlyArray<string> {
  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(requestUrl ?? "/", "http://localhost").searchParams;
  } catch {
    return Object.freeze([]);
  }

  const values = new Set<string>();
  for (const key of CanonicalWorkspaceHintQueryKeys) {
    const value = normalizeOptionalString(searchParams.get(key));
    if (value) {
      values.add(value);
    }
  }

  for (const [key, rawValue] of searchParams.entries()) {
    if (!/workspaceid$/i.test(key) || CanonicalWorkspaceHintQueryKeys.includes(key as never)) {
      continue;
    }
    const value = normalizeOptionalString(rawValue);
    if (value) {
      values.add(value);
    }
  }

  return Object.freeze([...values]);
}

function normalizeOptionalString(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
