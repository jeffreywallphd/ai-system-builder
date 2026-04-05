import { describe, expect, it } from "bun:test";
import {
  AuthorizationPolicyDecisionDenialReasons,
  AuthorizationPolicyEvaluationTargetKinds,
  type AuthorizationPolicyDecisionEvaluationRequest,
  type AuthorizationPolicyDecisionEvaluationResult,
} from "../../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../../../../src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationResourceFamilies } from "../../../../src/domain/authorization/AuthorizationPermissionCatalog";
import {
  AuthorizationTransportFailureCodes,
  AuthorizationTransportPolicyGuard,
} from "../AuthorizationTransportPolicyGuard";
import {
  HttpAuthorizationGuardAdapter,
  IpcAuthorizationGuardAdapter,
  WebSocketAuthorizationGuardAdapter,
} from "../AuthorizationTransportAdapters";

interface TestContext {
  readonly actorUserIdentityId?: string;
  readonly workspaceId?: string;
  readonly resourceId?: string;
}

class StubDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public readonly requests: AuthorizationPolicyDecisionEvaluationRequest[] = [];

  public constructor(
    private readonly implementation: (
      request: AuthorizationPolicyDecisionEvaluationRequest,
    ) => AuthorizationPolicyDecisionEvaluationResult,
  ) {}

  public async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    this.requests.push(request);
    return this.implementation(request);
  }
}

describe("Authorization transport adapters", () => {
  it("authorizes allowed resource-instance checks with minimal handler context wiring", async () => {
    const evaluator = new StubDecisionEvaluator(() => allowDecision("asset.read"));
    const policyGuard = new AuthorizationTransportPolicyGuard<TestContext>({
      decisionEvaluator: evaluator,
      resolveActor: (context) => Object.freeze({
        actorUserIdentityId: context.actorUserIdentityId,
        activeWorkspaceId: context.workspaceId,
      }),
    });
    const http = new HttpAuthorizationGuardAdapter(policyGuard);

    const authorized = await http.authorize(
      Object.freeze({
        actorUserIdentityId: "user-1",
        workspaceId: "workspace-alpha",
        resourceId: "asset-1",
      }),
      Object.freeze({
        requiredPermissionKey: "asset.read",
        target: Object.freeze({
          kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: (context: TestContext) => context.resourceId ?? "",
        }),
      }),
    );

    expect(authorized.ok).toBeTrue();
    expect(evaluator.requests).toHaveLength(1);
    expect(evaluator.requests[0]).toEqual({
      actor: {
        actorUserIdentityId: "user-1",
        actorServiceId: undefined,
        activeWorkspaceId: "workspace-alpha",
        authenticatedAt: undefined,
      },
      requiredPermissionKey: "asset.read",
      asOf: undefined,
      includeDebugDetails: false,
      target: {
        kind: "resource-instance",
        resource: {
          resourceFamily: "asset",
          resourceType: "asset",
          resourceId: "asset-1",
        },
      },
    });
  });

  it("maps denied outcomes to consistent forbidden responses across adapters", async () => {
    const evaluator = new StubDecisionEvaluator(() => denyDecision({
      requiredPermissionKey: "asset.update",
      reasonCode: "no-effective-permission",
      reason: "Access denied.",
      denialReason: AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
    }));
    const guard = new AuthorizationTransportPolicyGuard<TestContext>({
      decisionEvaluator: evaluator,
      resolveActor: (context) => Object.freeze({ actorUserIdentityId: context.actorUserIdentityId }),
    });
    const requirement = Object.freeze({
      requiredPermissionKey: "asset.update",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      }),
    });

    const http = await new HttpAuthorizationGuardAdapter(guard).authorize(
      Object.freeze({ actorUserIdentityId: "user-member" }),
      requirement,
    );
    expect(http.ok).toBeFalse();
    if (!http.ok) {
      expect(http.statusCode).toBe(403);
      expect(http.body.error.code).toBe(AuthorizationTransportFailureCodes.forbidden);
      expect(http.body.error.reasonCode).toBe("no-effective-permission");
    }

    const socket = await new WebSocketAuthorizationGuardAdapter(guard).authorize(
      Object.freeze({ actorUserIdentityId: "user-member" }),
      requirement,
    );
    expect(socket.ok).toBeFalse();
    if (!socket.ok) {
      expect(socket.closeCode).toBe(4403);
      expect(socket.error.code).toBe(AuthorizationTransportFailureCodes.forbidden);
    }

    await expect(async () => {
      await new IpcAuthorizationGuardAdapter(guard).authorizeOrThrow(
        Object.freeze({ actorUserIdentityId: "user-member" }),
        requirement,
      );
    }).toThrow("forbidden:Access denied.");
  });

  it("maps missing actor identity to unauthorized transport failures", async () => {
    const evaluator = new StubDecisionEvaluator(() => allowDecision("asset.read"));
    const guard = new AuthorizationTransportPolicyGuard<TestContext>({
      decisionEvaluator: evaluator,
      resolveActor: () => Object.freeze({}),
    });
    const requirement = Object.freeze({
      requiredPermissionKey: "asset.read",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      }),
    });

    const http = await new HttpAuthorizationGuardAdapter(guard).authorize(Object.freeze({}), requirement);
    expect(http.ok).toBeFalse();
    if (!http.ok) {
      expect(http.statusCode).toBe(401);
      expect(http.body.error.code).toBe(AuthorizationTransportFailureCodes.unauthorized);
    }
    expect(evaluator.requests).toHaveLength(0);
  });

  it("returns invalid-request for malformed target context and avoids evaluator calls", async () => {
    const evaluator = new StubDecisionEvaluator(() => allowDecision("asset.read"));
    const guard = new AuthorizationTransportPolicyGuard<TestContext>({
      decisionEvaluator: evaluator,
      resolveActor: (context) => Object.freeze({ actorUserIdentityId: context.actorUserIdentityId }),
    });

    const result = await new HttpAuthorizationGuardAdapter(guard).authorize(
      Object.freeze({
        actorUserIdentityId: "user-1",
        resourceId: " ",
      }),
      Object.freeze({
        requiredPermissionKey: "asset.read",
        target: Object.freeze({
          kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: (context: TestContext) => context.resourceId ?? "",
        }),
      }),
    );

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.statusCode).toBe(400);
      expect(result.body.error.code).toBe(AuthorizationTransportFailureCodes.invalidRequest);
      expect(result.body.error.denialReason).toBe(AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext);
    }
    expect(evaluator.requests).toHaveLength(0);
  });

  it("supports workspace-capability authorization requirements", async () => {
    const evaluator = new StubDecisionEvaluator((request) => {
      expect(request.target.kind).toBe(AuthorizationPolicyEvaluationTargetKinds.workspaceCapability);
      expect(request.target.workspaceId).toBe("workspace-beta");
      expect(request.target.capabilityResourceType).toBe("system");
      return allowDecision("system.manage");
    });
    const guard = new AuthorizationTransportPolicyGuard<TestContext>({
      decisionEvaluator: evaluator,
      resolveActor: (context) => Object.freeze({ actorServiceId: context.actorUserIdentityId }),
    });

    const socket = await new WebSocketAuthorizationGuardAdapter(guard).authorize(
      Object.freeze({
        actorUserIdentityId: "runtime-service",
        workspaceId: "workspace-beta",
      }),
      Object.freeze({
        requiredPermissionKey: "system.manage",
        target: Object.freeze({
          kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
          workspaceId: (context: TestContext) => context.workspaceId ?? "",
          capabilityResourceType: "system",
        }),
      }),
    );

    expect(socket.ok).toBeTrue();
    expect(evaluator.requests).toHaveLength(1);
  });
});

function allowDecision(requiredPermissionKey: string): AuthorizationPolicyDecisionEvaluationResult {
  return Object.freeze({
    decision: Object.freeze({
      isAllowed: true,
      outcome: "allow",
      requiredPermissionKey,
      reasonCode: "matched-role-grant",
      reason: "Allowed.",
      denialReason: undefined,
      evaluatedAt: "2026-04-05T18:00:00.000Z",
      matchedRoleAssignmentIds: Object.freeze(["role-1"]),
      matchedPermissionGrantIds: Object.freeze([]),
      matchedSharingGrantIds: Object.freeze([]),
    }),
  });
}

function denyDecision(input: {
  readonly requiredPermissionKey: string;
  readonly reasonCode: string;
  readonly reason: string;
  readonly denialReason: AuthorizationPolicyDecisionEvaluationResult["decision"]["denialReason"];
}): AuthorizationPolicyDecisionEvaluationResult {
  return Object.freeze({
    decision: Object.freeze({
      isAllowed: false,
      outcome: "deny",
      requiredPermissionKey: input.requiredPermissionKey,
      reasonCode: input.reasonCode,
      reason: input.reason,
      denialReason: input.denialReason,
      evaluatedAt: "2026-04-05T18:00:00.000Z",
      matchedRoleAssignmentIds: Object.freeze([]),
      matchedPermissionGrantIds: Object.freeze([]),
      matchedSharingGrantIds: Object.freeze([]),
    }),
  });
}
