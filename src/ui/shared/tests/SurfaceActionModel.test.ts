import { describe, expect, it } from "bun:test";
import {
  createSurfaceActionContext,
  invokeSurfaceAction,
  resolveSurfaceActionDescriptors,
  toVisibleSurfaceActions,
  type SurfaceActionDescriptor,
} from "../actions";

describe("SurfaceActionModel", () => {
  it("resolves permission-restricted actions to hidden and disabled states", () => {
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:view"]),
      surface: "desktop",
      surfaceCapabilities: Object.freeze(["inline-actions"]),
    });

    const descriptors: ReadonlyArray<SurfaceActionDescriptor> = Object.freeze([
      {
        id: "refresh",
        label: "Refresh",
        scope: "page",
        requiredPermissions: Object.freeze(["nodes:refresh"]),
        permissionRestrictionBehavior: "hidden",
        onInvoke: () => undefined,
      },
      {
        id: "danger",
        label: "Delete",
        scope: "bulk",
        requiredPermissions: Object.freeze(["nodes:delete"]),
        permissionRestrictionBehavior: "disabled",
        onInvoke: () => undefined,
      },
    ]);

    const resolved = resolveSurfaceActionDescriptors(descriptors, context);

    expect(resolved[0]?.visibility).toBe("hidden");
    expect(resolved[1]?.visibility).toBe("disabled");
    expect(resolved[1]?.disabledReason).toContain("nodes:delete");
    expect(toVisibleSurfaceActions(resolved)).toHaveLength(1);
  });

  it("resolves availability hidden/disabled states from resource context", () => {
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:view"]),
      surface: "thin-client",
      resource: Object.freeze({ isArchived: true }),
    });

    const descriptors: ReadonlyArray<SurfaceActionDescriptor<{ readonly isArchived: boolean }>> = Object.freeze([
      {
        id: "inspect",
        label: "Inspect",
        scope: "row",
        availability: ({ resource }) => resource?.isArchived
          ? Object.freeze({ hidden: true, hiddenReason: "Archived rows are hidden on this surface." })
          : Object.freeze({}),
        onInvoke: () => undefined,
      },
      {
        id: "retry",
        label: "Retry",
        scope: "row",
        availability: ({ resource }) => resource?.isArchived
          ? Object.freeze({ disabled: true, disabledReason: "Archived rows cannot be retried." })
          : Object.freeze({}),
        onInvoke: () => undefined,
      },
    ]);

    const resolved = resolveSurfaceActionDescriptors(descriptors, context);

    expect(resolved[0]?.visibility).toBe("hidden");
    expect(resolved[1]?.visibility).toBe("disabled");
    expect(resolved[1]?.disabledReason).toBe("Archived rows cannot be retried.");
  });

  it("invokes confirmations and telemetry before action execution", async () => {
    let invokedCount = 0;
    const telemetryEvents: Array<string | undefined> = [];

    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:revoke"]),
      surface: "desktop",
      surfaceCapabilities: Object.freeze(["confirmations"]),
    });

    const [descriptor] = resolveSurfaceActionDescriptors(Object.freeze([{
      id: "revoke",
      label: "Revoke",
      scope: "bulk",
      tone: "danger",
      telemetry: Object.freeze({ eventName: "ui.node.revoke", auditCategory: "node-admin" }),
      confirmation: Object.freeze({
        title: "Revoke node?",
        message: "This action removes trust for the node.",
      }),
      onInvoke: () => {
        invokedCount += 1;
      },
    } satisfies SurfaceActionDescriptor]), context);

    const deniedResult = await invokeSurfaceAction(descriptor, context, {
      confirm: () => false,
    });

    expect(deniedResult.invoked).toBeFalse();
    expect(invokedCount).toBe(0);

    const approvedResult = await invokeSurfaceAction(descriptor, context, {
      confirm: () => true,
      onTelemetry: (event) => {
        telemetryEvents.push(event.eventName);
      },
    });

    expect(approvedResult.invoked).toBeTrue();
    expect(invokedCount).toBe(1);
    expect(telemetryEvents).toEqual(["ui.node.revoke"]);
  });
});
