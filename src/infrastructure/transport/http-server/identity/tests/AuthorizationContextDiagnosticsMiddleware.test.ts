import { describe, expect, it } from "bun:test";
import type { IncomingMessage } from "node:http";
import {
  AuthorizationContextResolutionReasonCodes,
  AuthorizationDiagnosticOutcomes,
} from "@shared/contracts/authorization/AuthorizationDiagnosticsContracts";
import {
  buildAuthorizationContextSnapshotDiagnostic,
  resolveAuthorizationRequestContextHints,
} from "../middleware/authorization-context-diagnostics";

function createRequest(input: { readonly method?: string; readonly url?: string }): IncomingMessage {
  return {
    method: input.method,
    url: input.url,
  } as IncomingMessage;
}

describe("authorization-context-diagnostics middleware utilities", () => {
  it("resolves request family, operation name, and workspace hints", () => {
    const hints = resolveAuthorizationRequestContextHints(createRequest({
      method: "post",
      url: "/api/v1/authorization/resources/asset/asset/asset-1/sharing-grants?workspaceId=workspace-alpha",
    }));

    expect(hints.requestFamily).toBe("authorization");
    expect(hints.operationName).toBe("POST /api/v1/authorization/resources/asset/asset/asset-1/sharing-grants");
    expect(hints.workspaceHintState).toBe("resolved");
    expect(hints.workspaceHint).toBe("workspace-alpha");
    expect(hints.workspaceHintCount).toBe(1);
  });

  it("marks workspace hint state ambiguous when conflicting workspace hints are present", () => {
    const hints = resolveAuthorizationRequestContextHints(createRequest({
      method: "GET",
      url: "/api/v1/runtime/runs/start?workspaceId=workspace-a&targetWorkspaceId=workspace-b",
    }));

    expect(hints.requestFamily).toBe("runtime");
    expect(hints.workspaceHintState).toBe("ambiguous");
    expect(hints.workspaceHintCount).toBe(2);
  });

  it("builds observed snapshot diagnostics without requiring permission context", () => {
    const hints = resolveAuthorizationRequestContextHints(createRequest({
      method: "GET",
      url: "/api/v1/identity/session",
    }));

    const diagnostic = buildAuthorizationContextSnapshotDiagnostic({
      requestId: "req-ctx-observed",
      correlationId: "corr-ctx-observed",
      actorIdentityId: "user-1",
      hints,
      reasonCode: AuthorizationContextResolutionReasonCodes.contextSnapshotCaptured,
      outcome: AuthorizationDiagnosticOutcomes.observed,
    });

    expect(diagnostic.outcome).toBe(AuthorizationDiagnosticOutcomes.observed);
    expect(diagnostic.denialProvenanceStage).toBe("actor-snapshot");
    expect(diagnostic.actor.actorIdentityId).toBe("user-1");
    expect(diagnostic.extensions?.["identity.request-family"]).toBe("identity");
  });

  it("builds deny snapshot diagnostics for missing workspace context at actor-snapshot stage", () => {
    const hints = resolveAuthorizationRequestContextHints(createRequest({
      method: "POST",
      url: "/api/v1/storage/instances",
    }));

    const diagnostic = buildAuthorizationContextSnapshotDiagnostic({
      requestId: "req-ctx-missing-workspace",
      correlationId: "corr-ctx-missing-workspace",
      actorIdentityId: "user-2",
      hints,
      reasonCode: AuthorizationContextResolutionReasonCodes.workspaceContextMissing,
      outcome: AuthorizationDiagnosticOutcomes.deny,
    });

    expect(diagnostic.outcome).toBe("deny");
    expect(diagnostic.reasonCode).toBe(AuthorizationContextResolutionReasonCodes.workspaceContextMissing);
    expect(diagnostic.requiredPermissionKey).toBeUndefined();
    expect(diagnostic.matchedSourceKind).toBe("not-evaluated");
  });
});
