import { describe, expect, it } from "bun:test";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  InvariantTargetKinds,
  composeInvariantFixtures,
  executeAndAssertInvariantScenario,
  type InvariantScenarioDefinition,
} from "@testing/invariants";
import { createAuthorizationInvariantRuntimeFixture } from "@testing/invariants/composedRuntimeFixtures";
import {
  AuthorizationRuntimeGrantInvariantAdapter,
  buildRuntimeInvariantFixtureBag,
  type AuthorizationRuntimeGrantRequestInput,
} from "./AuthorizationRuntimeInvariantCoverageTestSupport";

const OWNER_USERNAME = "runtime.invariant.owner";
const VIEWER_USERNAME = "runtime.invariant.viewer";

describe("Asset authorization runtime composed invariant coverage", () => {
  it("uses shared composed runtime fixtures to validate authorization mutation allow/deny behavior", async () => {
    const runtimeFixture = await createAuthorizationInvariantRuntimeFixture({
      workspaceId: "workspace-runtime-invariant",
      resourceId: "asset-runtime-invariant-1",
    });

    try {
      expect(runtimeFixture.participants.routeFamily.routeFamilyId).toBe("authorization-management");
      expect(runtimeFixture.participants.evaluator.policyDecisionEvaluator).toBe("AuthorizationPolicyDecisionEvaluator");
      expect(runtimeFixture.participants.repositories.policyReadRepository).toBe("SqliteAuthorizationPolicyReadAdapter");

      const owner = await runtimeFixture.registerAndLogin(OWNER_USERNAME, "runtime.invariant.owner@example.com");
      const viewer = await runtimeFixture.registerAndLogin(VIEWER_USERNAME, "runtime.invariant.viewer@example.com");

      await runtimeFixture.seedWorkspaceAssetAuthorizationResource({
        ownerUserIdentityId: owner.userIdentityId,
        viewerUserIdentityId: viewer.userIdentityId,
      });

      const allowScenario: InvariantScenarioDefinition<AuthorizationRuntimeGrantRequestInput> = Object.freeze({
        scenarioId: "authorization-runtime-composed-owner-share-allowed",
        title: "owner can grant explicit sharing through composed authorization route family",
        family: InvariantFeatureFamilies.asset,
        capability: "asset.share",
        actor: Object.freeze({
          actorUserIdentityId: owner.userIdentityId,
          activeWorkspaceId: runtimeFixture.workspaceId,
          roleKeys: Object.freeze(["owner"]),
        }),
        workspace: Object.freeze({
          workspaceId: runtimeFixture.workspaceId,
          ownerUserIdentityId: owner.userIdentityId,
        }),
        target: Object.freeze({
          targetKind: InvariantTargetKinds.resource,
          resourceFamily: "asset",
          resourceType: runtimeFixture.resourceType,
          resourceId: runtimeFixture.resourceId,
          workspaceId: runtimeFixture.workspaceId,
          targetWorkspaceId: runtimeFixture.workspaceId,
          ownerUserIdentityId: owner.userIdentityId,
        }),
        resource: Object.freeze({
          resourceFamily: "asset",
          resourceType: runtimeFixture.resourceType,
          resourceId: runtimeFixture.resourceId,
          workspaceId: runtimeFixture.workspaceId,
          ownerUserIdentityId: owner.userIdentityId,
        }),
        input: Object.freeze({
          sessionToken: owner.sessionToken,
          resourceFamily: "asset",
          resourceType: runtimeFixture.resourceType,
          resourceId: runtimeFixture.resourceId,
          grant: Object.freeze({
            id: "runtime-invariant-share-allow",
            target: Object.freeze({
              kind: "user",
              userId: viewer.userIdentityId,
            }),
            permissionKeys: Object.freeze(["asset.read"]),
          }),
        }),
        expectation: Object.freeze({
          outcome: "allow",
          decision: Object.freeze({
            reasonCode: "transport-accepted",
            sourceKind: "composed-runtime-route-family",
            targetKind: InvariantTargetKinds.resource,
            requiredPermissionKey: "asset.read",
            scope: Object.freeze({
              isApplicable: true,
              scopeKind: "workspace",
              workspaceId: runtimeFixture.workspaceId,
              resourceFamily: "asset",
              resourceType: runtimeFixture.resourceType,
              resourceId: runtimeFixture.resourceId,
            }),
            provenance: Object.freeze({
              routeFamilyId: runtimeFixture.participants.routeFamily.routeFamilyId,
              evaluator: runtimeFixture.participants.evaluator.policyDecisionEvaluator,
            }),
          }),
          runtime: Object.freeze({
            statusCode: "200",
          }),
        }),
        tags: Object.freeze(["authorization", "runtime-composed", "asset", "share", "allow"]),
      });

      const denyScenario: InvariantScenarioDefinition<AuthorizationRuntimeGrantRequestInput> = Object.freeze({
        ...allowScenario,
        scenarioId: "authorization-runtime-composed-viewer-share-denied",
        title: "viewer is denied explicit share mutation through composed authorization route family",
        actor: Object.freeze({
          actorUserIdentityId: viewer.userIdentityId,
          activeWorkspaceId: runtimeFixture.workspaceId,
          roleKeys: Object.freeze(["viewer"]),
        }),
        input: Object.freeze({
          sessionToken: viewer.sessionToken,
          resourceFamily: "asset",
          resourceType: runtimeFixture.resourceType,
          resourceId: runtimeFixture.resourceId,
          grant: Object.freeze({
            id: "runtime-invariant-share-denied",
            target: Object.freeze({
              kind: "user",
              userId: owner.userIdentityId,
            }),
            permissionKeys: Object.freeze(["asset.read"]),
          }),
        }),
        expectation: Object.freeze({
          outcome: "deny",
          decision: Object.freeze({
            reasonCode: "transport-denied",
            denialReason: "forbidden",
            sourceKind: "composed-runtime-route-family",
            targetKind: InvariantTargetKinds.resource,
            requiredPermissionKey: "asset.read",
            scope: Object.freeze({
              isApplicable: true,
              scopeKind: "workspace",
              workspaceId: runtimeFixture.workspaceId,
              resourceFamily: "asset",
              resourceType: runtimeFixture.resourceType,
              resourceId: runtimeFixture.resourceId,
            }),
            provenance: Object.freeze({
              routeFamilyId: runtimeFixture.participants.routeFamily.routeFamilyId,
              evaluator: runtimeFixture.participants.evaluator.policyDecisionEvaluator,
            }),
          }),
          runtime: Object.freeze({
            statusCode: "403",
          }),
        }),
        tags: Object.freeze(["authorization", "runtime-composed", "asset", "share", "deny"]),
      });

      const registry = new InvariantAdapterRegistry().register(
        new AuthorizationRuntimeGrantInvariantAdapter(InvariantFeatureFamilies.asset),
      );
      const fixtures = await composeInvariantFixtures(buildRuntimeInvariantFixtureBag(runtimeFixture));

      for (const scenario of [allowScenario, denyScenario]) {
        const execution = await executeAndAssertInvariantScenario(registry, {
          scenario,
          fixtures,
          now: () => new Date("2026-04-13T00:00:00.000Z"),
        });

        expect(execution.observed.decision?.provenance?.routeFamilyId).toBe(
          runtimeFixture.participants.routeFamily.routeFamilyId,
        );
        expect(execution.observed.runtime?.statusCode).toBe(scenario.expectation.runtime?.statusCode);
      }
    } finally {
      await runtimeFixture.dispose();
    }
  });
});
