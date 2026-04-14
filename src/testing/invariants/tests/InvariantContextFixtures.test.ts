import { describe, expect, it } from "bun:test";
import {
  InvariantTargetKinds,
  InvariantWorkspaceRelationshipModes,
  buildAlignedInvariantWorkspaceRelationshipFixture,
  buildCapabilityTargetContext,
  buildInvariantActorContext,
  buildInvariantResourceContext,
  buildInvariantTargetContext,
  buildInvariantWorkspaceRelationshipFixture,
  normalizeInvariantIdentifier,
  normalizeInvariantIdentifierMap,
} from "../index";

describe("Invariant context fixture builders", () => {
  it("normalizes required identifiers and rejects empty values", () => {
    expect(normalizeInvariantIdentifier("  workspace:alpha  ", "workspaceId")).toBe("workspace:alpha");
    expect(() => normalizeInvariantIdentifier("   ", "workspaceId")).toThrow("workspaceId must not be empty.");
  });

  it("normalizes identifier maps and drops undefined keys", () => {
    const identifiers = normalizeInvariantIdentifierMap({
      " resourceId ": " asset:1 ",
      capabilityKey: undefined,
    });

    expect(identifiers).toEqual({
      resourceId: "asset:1",
    });
  });

  it("builds actor context with deterministic defaults", () => {
    const actor = buildInvariantActorContext({
      activeWorkspaceId: " workspace:active ",
    });

    expect(actor.actorUserIdentityId).toBe("user:actor-default");
    expect(actor.activeWorkspaceId).toBe("workspace:active");
  });

  it("builds resource and target contexts as separate normalized surfaces", () => {
    const resource = buildInvariantResourceContext({
      resourceId: " asset:resource:1 ",
      workspaceId: " workspace:resource ",
      ownerUserIdentityId: " user:owner ",
    });
    const target = buildInvariantTargetContext({
      targetWorkspaceId: " workspace:target ",
      resourceId: " asset:target:1 ",
      ownerUserIdentityId: " user:delegate ",
    });

    expect(resource.resourceId).toBe("asset:resource:1");
    expect(resource.workspaceId).toBe("workspace:resource");
    expect(target.resourceId).toBe("asset:target:1");
    expect(target.targetWorkspaceId).toBe("workspace:target");
    expect(target.workspaceId).toBe("workspace:target");
  });

  it("builds capability targets for permission checks without concrete resource instances", () => {
    const target = buildCapabilityTargetContext({
      capabilityKey: " Asset.Read ",
      targetWorkspaceId: " workspace:authz ",
    });

    expect(target.targetKind).toBe(InvariantTargetKinds.capability);
    expect(target.resourceFamily).toBe("capability-target");
    expect(target.resourceType).toBe("capability-target");
    expect(target.resourceId).toBe("capability:Asset.Read");
    expect(target.identifiers).toEqual({
      capabilityKey: "Asset.Read",
      resourceId: "capability:Asset.Read",
    });
  });

  it("builds aligned actor/target/resource workspace relationships by default", () => {
    const fixture = buildAlignedInvariantWorkspaceRelationshipFixture({
      actor: {
        actorUserIdentityId: " user:alpha ",
      },
      activeWorkspace: {
        workspaceId: " workspace:alpha ",
      },
    });

    expect(fixture.actor.activeWorkspaceId).toBe("workspace:alpha");
    expect(fixture.targetWorkspace.workspaceId).toBe("workspace:alpha");
    expect(fixture.resourceWorkspace.workspaceId).toBe("workspace:alpha");
    expect(fixture.target.targetWorkspaceId).toBe("workspace:alpha");
    expect(fixture.resource.workspaceId).toBe("workspace:alpha");
  });

  it("supports divergence fixtures without ad hoc setup", () => {
    const fixture = buildInvariantWorkspaceRelationshipFixture({
      mode: InvariantWorkspaceRelationshipModes.targetVsResourceMismatch,
      activeWorkspace: {
        workspaceId: "workspace:alpha",
      },
    });

    expect(fixture.actor.activeWorkspaceId).toBe("workspace:alpha");
    expect(fixture.targetWorkspace.workspaceId).toBe("workspace:alpha");
    expect(fixture.resourceWorkspace.workspaceId).toBe("workspace:alpha:resource");
    expect(fixture.target.targetWorkspaceId).toBe("workspace:alpha");
    expect(fixture.resource.workspaceId).toBe("workspace:alpha:resource");
  });
});
