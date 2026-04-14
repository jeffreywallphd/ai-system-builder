import { describe, expect, it } from "bun:test";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  buildAlignedInvariantWorkspaceRelationshipFixture,
  composeInvariantFixtures,
  executeAndAssertInvariantScenario,
  executeInvariantScenario,
  type InvariantFamilyAdapter,
  type InvariantScenarioDefinition,
} from "../index";

interface AssetReadScenarioInput {
  readonly resourceVisibility: "shared" | "private";
}

const nowIso = "2026-04-13T12:00:00.000Z";

class AssetInvariantAdapter implements InvariantFamilyAdapter<AssetReadScenarioInput> {
  public readonly family = InvariantFeatureFamilies.asset;

  public async evaluate(request: {
    readonly scenario: InvariantScenarioDefinition<AssetReadScenarioInput>;
    readonly evaluatedAt: string;
    readonly fixtures: Readonly<Record<string, unknown>>;
  }) {
    const readPermission = request.scenario.capability;
    const isSharedResource = request.scenario.input?.resourceVisibility === "shared";
    const actor = request.scenario.actor.actorUserIdentityId;
    const allow = isSharedResource || actor === request.scenario.target.ownerUserIdentityId;
    const sharedId = request.scenario.target.resourceId;
    const fixtureRegion = String(request.fixtures.region ?? "unknown");

    return Object.freeze({
      outcome: allow ? "allow" : "deny",
      decision: Object.freeze({
        requiredPermissionKey: readPermission,
        reasonCode: allow ? "matched-sharing-grant" : "insufficient-permissions",
        denialReason: allow ? undefined : "insufficient-permissions",
        matchedSharingGrantIds: allow && isSharedResource ? Object.freeze(["share:asset:reader"]) : Object.freeze([]),
      }),
      runtime: Object.freeze({
        statusCode: allow ? "ok" : "forbidden",
        visibleResourceIds: allow ? Object.freeze([sharedId]) : Object.freeze([]),
        notes: Object.freeze([`fixture-region:${fixtureRegion}`]),
      }),
    });
  }
}

class RunInvariantAdapter implements InvariantFamilyAdapter {
  public readonly family = InvariantFeatureFamilies.run;

  public async evaluate() {
    return Object.freeze({
      outcome: "allow" as const,
      decision: Object.freeze({
        reasonCode: "matched-role-grant",
      }),
      runtime: Object.freeze({
        statusCode: "ok",
      }),
    });
  }
}

describe("Invariant framework harness", () => {
  it("exposes required cross-feature families for shared invariant adapters", () => {
    expect(Object.values(InvariantFeatureFamilies)).toEqual(
      expect.arrayContaining([
        "asset",
        "workflow",
        "system",
        "run",
        "storage",
        "secret",
        "admin-deployment",
      ]),
    );
  });

  it("composes fixtures and validates a shared-asset authorization scenario", async () => {
    const fixtures = await composeInvariantFixtures(
      Object.freeze({ region: "us-east" }),
      (current) => Object.freeze({ ...current, mode: "integration" }),
    );
    const contexts = buildAlignedInvariantWorkspaceRelationshipFixture({
      actor: Object.freeze({
        actorUserIdentityId: "user-collab",
      }),
      activeWorkspace: Object.freeze({
        workspaceId: "workspace-alpha",
        ownerUserIdentityId: "user-owner",
      }),
      resource: Object.freeze({
        resourceFamily: "asset",
        resourceType: "asset",
        resourceId: "asset:shared:1",
        ownerUserIdentityId: "user-owner",
      }),
    });

    const registry = new InvariantAdapterRegistry()
      .register(new AssetInvariantAdapter())
      .register(new RunInvariantAdapter());

    const scenario: InvariantScenarioDefinition<AssetReadScenarioInput> = Object.freeze({
      scenarioId: "asset-shared-read-collaborator",
      title: "collaborator can read explicitly shared asset",
      family: InvariantFeatureFamilies.asset,
      capability: "asset.read",
      actor: contexts.actor,
      workspace: contexts.activeWorkspace,
      target: contexts.target,
      resource: contexts.resource,
      input: Object.freeze({
        resourceVisibility: "shared",
      }),
      expectation: Object.freeze({
        outcome: "allow",
        decision: Object.freeze({
          reasonCode: "matched-sharing-grant",
          requiredPermissionKey: "asset.read",
          matchedSharingGrantIds: Object.freeze(["share:asset:reader"]),
        }),
        runtime: Object.freeze({
          statusCode: "ok",
          visibleResourceIds: Object.freeze(["asset:shared:1"]),
        }),
      }),
      tags: Object.freeze(["authorization", "workspace", "asset"]),
    });

    const execution = await executeAndAssertInvariantScenario(registry, {
      scenario,
      fixtures,
      now: () => new Date(nowIso),
    });

    expect(execution.evaluatedAt).toBe(nowIso);
    expect(execution.observed.runtime?.notes).toContain("fixture-region:us-east");
  });

  it("reports assertion failures when observed invariant outcome drifts from expectation", async () => {
    const registry = new InvariantAdapterRegistry().register(new AssetInvariantAdapter());
    const scenario: InvariantScenarioDefinition<AssetReadScenarioInput> = Object.freeze({
      scenarioId: "asset-private-read-denied",
      title: "non-owner cannot read private asset",
      family: InvariantFeatureFamilies.asset,
      capability: "asset.read",
      actor: Object.freeze({
        actorUserIdentityId: "user-collab",
        activeWorkspaceId: "workspace-alpha",
      }),
      workspace: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
      target: Object.freeze({
        resourceFamily: "asset",
        resourceType: "asset",
        resourceId: "asset:private:1",
        workspaceId: "workspace-alpha",
        ownerUserIdentityId: "user-owner",
      }),
      input: Object.freeze({
        resourceVisibility: "private",
      }),
      expectation: Object.freeze({
        outcome: "allow",
      }),
    });

    await expect(
      executeAndAssertInvariantScenario(registry, {
        scenario,
        now: () => new Date(nowIso),
      }),
    ).rejects.toThrow("expected authorization outcome 'allow' but observed 'deny'");
  });

  it("guards adapter registration and family lookup behavior", async () => {
    const registry = new InvariantAdapterRegistry().register(new RunInvariantAdapter());
    expect(() => {
      registry.register(new RunInvariantAdapter());
    }).toThrow("already registered");

    const scenario: InvariantScenarioDefinition = Object.freeze({
      scenarioId: "missing-adapter-for-secret-family",
      title: "secret family requires explicit adapter registration",
      family: InvariantFeatureFamilies.secret,
      capability: "secret-metadata.read",
      actor: Object.freeze({ actorUserIdentityId: "user-1" }),
      workspace: Object.freeze({ workspaceId: "workspace-alpha" }),
      target: Object.freeze({
        resourceFamily: "secret-metadata",
        resourceType: "secret-metadata",
        resourceId: "secret:1",
      }),
      expectation: Object.freeze({
        outcome: "deny",
      }),
    });

    await expect(
      executeInvariantScenario(registry, {
        scenario,
        now: () => new Date(nowIso),
      }),
    ).rejects.toThrow("No invariant adapter is registered for family 'secret'");
  });
});
