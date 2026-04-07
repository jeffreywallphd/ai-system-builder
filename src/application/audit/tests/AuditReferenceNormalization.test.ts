import { describe, expect, it } from "bun:test";
import {
  AuditActorKinds,
  AuditResourceSensitivityClasses,
  AuditScopeKinds,
} from "@domain/audit/AuditDomain";
import {
  normalizeAuditActionContextReference,
  normalizeAuditActorReference,
  normalizeAuditProtectedResourceReference,
  normalizeAuditScopeReference,
  normalizeAuthoritativeAuditReferences,
} from "../shared/AuditReferenceNormalization";

describe("AuditReferenceNormalization", () => {
  it("normalizes actor identifiers and backfills canonical user identity id", () => {
    const actor = normalizeAuditActorReference({
      actorId: "  user:admin-1  ",
      actorKind: AuditActorKinds.user,
      actorSessionId: " session/main ",
    });

    expect(actor.actorId).toBe("user:admin-1");
    expect(actor.actorUserIdentityId).toBe("user:admin-1");
    expect(actor.actorSessionId).toBe("session:main");
  });

  it("normalizes scope and protected-resource references to logical canonical refs", () => {
    const scope = normalizeAuditScopeReference({
      kind: AuditScopeKinds.workspace,
      workspaceId: " workspace/root ",
    });

    const resource = normalizeAuditProtectedResourceReference({
      resourceType: " Runtime Queue ",
      resourceId: " C:\\runtime\\queues\\primary ",
      resourceRef: "internal-db-row-id",
      sensitivityClass: AuditResourceSensitivityClasses.sensitive,
    }, scope);

    expect(scope.workspaceId).toBe("workspace:root");
    expect(resource?.resourceType).toBe("runtime-queue");
    expect(resource?.resourceId).toBe("C:runtime:queues:primary");
    expect(resource?.resourceRef).toBe("runtime-queue:C:runtime:queues:primary");
    expect(resource?.workspaceId).toBe("workspace:root");
  });

  it("normalizes correlation identifiers and action context refs", () => {
    const normalized = normalizeAuthoritativeAuditReferences({
      actor: {
        actorId: "service:runtime",
        actorKind: AuditActorKinds.service,
        actorServiceId: "service:runtime",
        actorSessionId: "runtime/session-1",
      },
      scope: {
        kind: AuditScopeKinds.global,
      },
      correlationId: " corr/runtime/1 ",
      requestId: " request/runtime/1 ",
      actionContext: {
        deviceId: " device/workstation ",
        nodeId: " node/gpu-west ",
      },
    });

    expect(normalized.correlationId).toBe("corr:runtime:1");
    expect(normalized.requestId).toBe("request:runtime:1");
    expect(normalized.actionContext?.sessionRef).toBe("session:runtime:session-1");
    expect(normalized.actionContext?.deviceRef).toBe("device:workstation");
    expect(normalized.actionContext?.nodeRef).toBe("node:gpu-west");
  });

  it("returns undefined action context when no session, device, or node reference exists", () => {
    const normalized = normalizeAuditActionContextReference(undefined, {
      actorId: "system:audit",
      actorKind: AuditActorKinds.system,
    });

    expect(normalized).toBeUndefined();
  });

  it("rejects global scope references that include workspace identifiers", () => {
    expect(() => normalizeAuditScopeReference({
      kind: AuditScopeKinds.global,
      workspaceId: "workspace:1",
    })).toThrow("Global audit scope cannot include workspaceId.");
  });
});
