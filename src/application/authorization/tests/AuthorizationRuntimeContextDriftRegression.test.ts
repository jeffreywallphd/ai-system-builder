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
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import {
  AuthorizationRuntimeAccessStateInvariantAdapter,
  AuthorizationRuntimeGrantInvariantAdapter,
  AuthorizationRuntimeWorkspaceReportInvariantAdapter,
  buildRuntimeInvariantFixtureBag,
  type AuthorizationRuntimeAccessStateRequestInput,
  type AuthorizationRuntimeGrantRequestInput,
  type AuthorizationRuntimeWorkspaceReportRequestInput,
} from "./AuthorizationRuntimeInvariantCoverageTestSupport";

const WORKSPACE_ALPHA = "workspace-runtime-context-alpha";
const WORKSPACE_BETA = "workspace-runtime-context-beta";
const RESOURCE_TYPE = "asset";
const GRANT_RESOURCE_ID = "asset-runtime-context-drift-grant";
const ACCESS_RESOURCE_ID = "asset-runtime-context-drift-access";

const OWNER_ALPHA_USERNAME = "runtime.context.owner.alpha";
const OWNER_BETA_USERNAME = "runtime.context.owner.beta";
const VIEWER_BETA_USERNAME = "runtime.context.viewer.beta";
const DRIFT_ACTOR_USERNAME = "runtime.context.drift.actor";
const FALLBACK_ACTOR_USERNAME = "runtime.context.fallback.actor";

describe("Authorization runtime composed context drift regressions", () => {
  it("guards against workspace-scope and cross-layer context drift regressions on composed authorization routes", async () => {
    const runtimeFixture = await createAuthorizationInvariantRuntimeFixture({
      workspaceId: WORKSPACE_BETA,
      resourceType: RESOURCE_TYPE,
      resourceId: GRANT_RESOURCE_ID,
    });

    try {
      const ownerAlpha = await runtimeFixture.registerAndLogin(OWNER_ALPHA_USERNAME, "runtime.context.owner.alpha@example.com");
      const ownerBeta = await runtimeFixture.registerAndLogin(OWNER_BETA_USERNAME, "runtime.context.owner.beta@example.com");
      const viewerBeta = await runtimeFixture.registerAndLogin(VIEWER_BETA_USERNAME, "runtime.context.viewer.beta@example.com");
      const driftActor = await runtimeFixture.registerAndLogin(DRIFT_ACTOR_USERNAME, "runtime.context.drift.actor@example.com");
      const fallbackActor = await runtimeFixture.registerAndLogin(
        FALLBACK_ACTOR_USERNAME,
        "runtime.context.fallback.actor@example.com",
      );

      await runtimeFixture.seedWorkspaceAssetAuthorizationResource({
        ownerUserIdentityId: ownerBeta.userIdentityId,
        viewerUserIdentityId: viewerBeta.userIdentityId,
        workspaceId: WORKSPACE_BETA,
        resourceType: RESOURCE_TYPE,
        resourceId: GRANT_RESOURCE_ID,
      });

      await runtimeFixture.seedWorkspaceAssetAuthorizationResource({
        ownerUserIdentityId: ownerBeta.userIdentityId,
        viewerUserIdentityId: viewerBeta.userIdentityId,
        workspaceId: WORKSPACE_BETA,
        resourceType: RESOURCE_TYPE,
        resourceId: ACCESS_RESOURCE_ID,
      });

      await runtimeFixture.seedWorkspaceRoleAssignment({
        actorUserIdentityId: driftActor.userIdentityId,
        assignedByUserIdentityId: ownerAlpha.userIdentityId,
        roleKey: "owner",
        workspaceId: WORKSPACE_ALPHA,
      });

      await runtimeFixture.seedWorkspaceAuthorizationSnapshot({
        workspaceId: WORKSPACE_ALPHA,
        userIdentityId: fallbackActor.userIdentityId,
        ownerUserIdentityId: ownerAlpha.userIdentityId,
        effectiveRoles: Object.freeze([WorkspaceRoles.owner]),
        membershipStatus: WorkspaceMembershipStatuses.active,
        isWorkspaceOwner: true,
      });

      const visibilityResponse = await fetch(
        `${runtimeFixture.baseUrl}/api/v1/authorization/resources/asset/${RESOURCE_TYPE}/${ACCESS_RESOURCE_ID}/visibility`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${ownerBeta.sessionToken}`,
          },
          body: JSON.stringify({
            workspaceId: WORKSPACE_BETA,
            visibility: "workspace",
            sharingPolicyMode: "workspace-members",
            allowResharing: false,
            sharingGrants: [],
            isPublishedCapable: false,
          }),
        },
      );
      expect(visibilityResponse.status).toBe(200);

      const fixtureBag = await composeInvariantFixtures(buildRuntimeInvariantFixtureBag(runtimeFixture));

      const accessRegistry = new InvariantAdapterRegistry()
        .register(new AuthorizationRuntimeAccessStateInvariantAdapter(InvariantFeatureFamilies.asset));
      const grantRegistry = new InvariantAdapterRegistry()
        .register(new AuthorizationRuntimeGrantInvariantAdapter(InvariantFeatureFamilies.asset));
      const reportRegistry = new InvariantAdapterRegistry()
        .register(new AuthorizationRuntimeWorkspaceReportInvariantAdapter(InvariantFeatureFamilies.system));

      const accessScenarios: ReadonlyArray<InvariantScenarioDefinition<AuthorizationRuntimeAccessStateRequestInput>> = Object.freeze([
        Object.freeze({
          scenarioId: "authorization-runtime-context-drift-read-allowed-create-denied-read",
          title: "read/list remains allowed while write stays denied for workspace visibility viewers",
          family: InvariantFeatureFamilies.asset,
          capability: "asset.read",
          actor: Object.freeze({
            actorUserIdentityId: viewerBeta.userIdentityId,
            activeWorkspaceId: WORKSPACE_BETA,
            roleKeys: Object.freeze(["viewer"]),
          }),
          workspace: Object.freeze({
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          target: Object.freeze({
            targetKind: InvariantTargetKinds.resource,
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: ACCESS_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            targetWorkspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          resource: Object.freeze({
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: ACCESS_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          input: Object.freeze({
            sessionToken: ownerBeta.sessionToken,
            resourceFamily: "asset",
            resourceType: RESOURCE_TYPE,
            resourceId: ACCESS_RESOURCE_ID,
            inspectedActorUserIdentityId: viewerBeta.userIdentityId,
            requiredPermissionKey: "asset.read",
            includeDenied: true,
          }),
          expectation: Object.freeze({
            outcome: "allow",
            decision: Object.freeze({
              reasonCode: "visibility-workspace-member",
              sourceKind: "composed-runtime-route-family",
              targetKind: InvariantTargetKinds.resource,
              requiredPermissionKey: "asset.read",
              scope: Object.freeze({
                isApplicable: true,
                scopeKind: "workspace",
                workspaceId: WORKSPACE_BETA,
                resourceFamily: AuthorizationResourceFamilies.asset,
                resourceType: RESOURCE_TYPE,
                resourceId: ACCESS_RESOURCE_ID,
              }),
            }),
            runtime: Object.freeze({
              statusCode: "200",
            }),
          }),
          tags: Object.freeze(["authorization", "runtime-composed", "workspace-visibility", "read-allowed"]),
        }),
        Object.freeze({
          scenarioId: "authorization-runtime-context-drift-read-allowed-create-denied-create",
          title: "workspace visibility does not leak create/write permissions for the same actor",
          family: InvariantFeatureFamilies.asset,
          capability: "asset.create",
          actor: Object.freeze({
            actorUserIdentityId: viewerBeta.userIdentityId,
            activeWorkspaceId: WORKSPACE_BETA,
            roleKeys: Object.freeze(["viewer"]),
          }),
          workspace: Object.freeze({
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          target: Object.freeze({
            targetKind: InvariantTargetKinds.resource,
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: ACCESS_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            targetWorkspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          resource: Object.freeze({
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: ACCESS_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          input: Object.freeze({
            sessionToken: ownerBeta.sessionToken,
            resourceFamily: "asset",
            resourceType: RESOURCE_TYPE,
            resourceId: ACCESS_RESOURCE_ID,
            inspectedActorUserIdentityId: viewerBeta.userIdentityId,
            requiredPermissionKey: "asset.create",
            includeDenied: true,
          }),
          expectation: Object.freeze({
            outcome: "deny",
            decision: Object.freeze({
              reasonCode: "no-effective-permission",
              denialReason: "insufficient-permissions",
              sourceKind: "composed-runtime-route-family",
              targetKind: InvariantTargetKinds.resource,
              requiredPermissionKey: "asset.create",
              scope: Object.freeze({
                isApplicable: true,
                scopeKind: "workspace",
                workspaceId: WORKSPACE_BETA,
                resourceFamily: AuthorizationResourceFamilies.asset,
                resourceType: RESOURCE_TYPE,
                resourceId: ACCESS_RESOURCE_ID,
              }),
            }),
            runtime: Object.freeze({
              statusCode: "200",
            }),
          }),
          tags: Object.freeze(["authorization", "runtime-composed", "workspace-visibility", "write-denied"]),
        }),
      ]);

      const grantScenarios: ReadonlyArray<InvariantScenarioDefinition<AuthorizationRuntimeGrantRequestInput>> = Object.freeze([
        Object.freeze({
          scenarioId: "authorization-runtime-context-drift-actor-active-workspace-mismatch-denied",
          title: "actor active workspace differing from target workspace denies resource-share mutation",
          family: InvariantFeatureFamilies.asset,
          capability: "asset.share",
          actor: Object.freeze({
            actorUserIdentityId: driftActor.userIdentityId,
            activeWorkspaceId: WORKSPACE_ALPHA,
            roleKeys: Object.freeze(["owner"]),
          }),
          workspace: Object.freeze({
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          target: Object.freeze({
            targetKind: InvariantTargetKinds.resource,
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            targetWorkspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          resource: Object.freeze({
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          input: Object.freeze({
            sessionToken: driftActor.sessionToken,
            workspaceId: WORKSPACE_ALPHA,
            resourceFamily: "asset",
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            grant: Object.freeze({
              id: "runtime-context-drift-active-workspace-mismatch",
              target: Object.freeze({
                kind: "user",
                userId: viewerBeta.userIdentityId,
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
                workspaceId: WORKSPACE_BETA,
                resourceFamily: AuthorizationResourceFamilies.asset,
                resourceType: RESOURCE_TYPE,
                resourceId: GRANT_RESOURCE_ID,
              }),
            }),
            runtime: Object.freeze({
              statusCode: "403",
            }),
          }),
          tags: Object.freeze(["authorization", "runtime-composed", "workspace-mismatch", "actor-vs-target"]),
        }),
        Object.freeze({
          scenarioId: "authorization-runtime-context-drift-resource-workspace-mismatch-conflict",
          title: "resource workspace divergence from requested target workspace returns conflict",
          family: InvariantFeatureFamilies.asset,
          capability: "asset.share",
          actor: Object.freeze({
            actorUserIdentityId: ownerBeta.userIdentityId,
            activeWorkspaceId: WORKSPACE_ALPHA,
            roleKeys: Object.freeze(["owner"]),
          }),
          workspace: Object.freeze({
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          target: Object.freeze({
            targetKind: InvariantTargetKinds.resource,
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            targetWorkspaceId: WORKSPACE_ALPHA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          resource: Object.freeze({
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          input: Object.freeze({
            sessionToken: ownerBeta.sessionToken,
            workspaceId: WORKSPACE_ALPHA,
            resourceFamily: "asset",
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            grant: Object.freeze({
              id: "runtime-context-drift-resource-workspace-conflict",
              target: Object.freeze({
                kind: "user",
                userId: viewerBeta.userIdentityId,
              }),
              permissionKeys: Object.freeze(["asset.read"]),
            }),
          }),
          expectation: Object.freeze({
            outcome: "deny",
            decision: Object.freeze({
              reasonCode: "transport-denied",
              denialReason: "conflict",
              sourceKind: "composed-runtime-route-family",
              targetKind: InvariantTargetKinds.resource,
              requiredPermissionKey: "asset.read",
              scope: Object.freeze({
                isApplicable: true,
                scopeKind: "workspace",
                workspaceId: WORKSPACE_BETA,
                resourceFamily: AuthorizationResourceFamilies.asset,
                resourceType: RESOURCE_TYPE,
                resourceId: GRANT_RESOURCE_ID,
              }),
            }),
            runtime: Object.freeze({
              statusCode: "409",
            }),
          }),
          tags: Object.freeze(["authorization", "runtime-composed", "workspace-mismatch", "resource-vs-target"]),
        }),
        Object.freeze({
          scenarioId: "authorization-runtime-context-drift-synthesized-fallback-scope-mismatch-denied",
          title: "synthesized workspace fallback role does not apply when workspace scope is wrong",
          family: InvariantFeatureFamilies.asset,
          capability: "asset.share",
          actor: Object.freeze({
            actorUserIdentityId: fallbackActor.userIdentityId,
            activeWorkspaceId: WORKSPACE_ALPHA,
            roleKeys: Object.freeze(["owner"]),
          }),
          workspace: Object.freeze({
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          target: Object.freeze({
            targetKind: InvariantTargetKinds.resource,
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            targetWorkspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          resource: Object.freeze({
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            workspaceId: WORKSPACE_BETA,
            ownerUserIdentityId: ownerBeta.userIdentityId,
          }),
          input: Object.freeze({
            sessionToken: fallbackActor.sessionToken,
            workspaceId: WORKSPACE_ALPHA,
            resourceFamily: "asset",
            resourceType: RESOURCE_TYPE,
            resourceId: GRANT_RESOURCE_ID,
            grant: Object.freeze({
              id: "runtime-context-drift-synth-fallback-scope-mismatch",
              target: Object.freeze({
                kind: "user",
                userId: viewerBeta.userIdentityId,
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
                workspaceId: WORKSPACE_BETA,
                resourceFamily: AuthorizationResourceFamilies.asset,
                resourceType: RESOURCE_TYPE,
                resourceId: GRANT_RESOURCE_ID,
              }),
            }),
            runtime: Object.freeze({
              statusCode: "403",
            }),
          }),
          tags: Object.freeze(["authorization", "runtime-composed", "workspace-mismatch", "synthesized-fallback"]),
        }),
      ]);

      const reportingScenario: InvariantScenarioDefinition<AuthorizationRuntimeWorkspaceReportRequestInput> = Object.freeze({
        scenarioId: "authorization-runtime-context-drift-capability-target-not-inferred-across-workspaces",
        title: "workspace capability authorization is denied when inferred from the wrong workspace",
        family: InvariantFeatureFamilies.system,
        capability: "system.manage",
        actor: Object.freeze({
          actorUserIdentityId: driftActor.userIdentityId,
          activeWorkspaceId: WORKSPACE_ALPHA,
          roleKeys: Object.freeze(["owner"]),
        }),
        workspace: Object.freeze({
          workspaceId: WORKSPACE_BETA,
          ownerUserIdentityId: ownerBeta.userIdentityId,
        }),
        target: Object.freeze({
          targetKind: InvariantTargetKinds.capability,
          resourceFamily: AuthorizationResourceFamilies.system,
          resourceType: "authorization-administration",
          resourceId: `capability:system.manage:${WORKSPACE_BETA}`,
          workspaceId: WORKSPACE_BETA,
          targetWorkspaceId: WORKSPACE_BETA,
        }),
        input: Object.freeze({
          sessionToken: driftActor.sessionToken,
          workspaceId: WORKSPACE_BETA,
        }),
        expectation: Object.freeze({
          outcome: "deny",
          decision: Object.freeze({
            reasonCode: "transport-denied",
            denialReason: "forbidden",
            sourceKind: "composed-runtime-route-family",
            targetKind: InvariantTargetKinds.capability,
            requiredPermissionKey: "system.manage",
            scope: Object.freeze({
              isApplicable: true,
              scopeKind: "workspace-capability",
              workspaceId: WORKSPACE_BETA,
              resourceFamily: AuthorizationResourceFamilies.system,
              resourceType: "authorization-administration",
              resourceId: `capability:system.manage:${WORKSPACE_BETA}`,
            }),
          }),
          runtime: Object.freeze({
            statusCode: "403",
          }),
        }),
        tags: Object.freeze(["authorization", "runtime-composed", "workspace-capability", "cross-workspace-drift"]),
      });

      for (const scenario of accessScenarios) {
        await executeAndAssertInvariantScenario(accessRegistry, {
          scenario,
          fixtures: fixtureBag,
          now: () => new Date("2026-04-13T00:00:00.000Z"),
        });
      }

      for (const scenario of grantScenarios) {
        await executeAndAssertInvariantScenario(grantRegistry, {
          scenario,
          fixtures: fixtureBag,
          now: () => new Date("2026-04-13T00:00:00.000Z"),
        });
      }

      await executeAndAssertInvariantScenario(reportRegistry, {
        scenario: reportingScenario,
        fixtures: fixtureBag,
        now: () => new Date("2026-04-13T00:00:00.000Z"),
      });
    } finally {
      await runtimeFixture.dispose();
    }
  });
});
