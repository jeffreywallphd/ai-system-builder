import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SurfaceActionButtonStrip,
  SurfaceActionList,
  SurfaceActionMenu,
  createSurfaceActionContext,
  type SurfaceActionDescriptor,
} from "../actions";
import { createSurfaceResponsiveProfile } from "../responsive";

const descriptors: ReadonlyArray<SurfaceActionDescriptor> = Object.freeze([
  {
    id: "desktop-refresh",
    label: "Refresh",
    scope: "page",
    tone: "secondary",
    priority: 10,
    onInvoke: () => undefined,
  },
  {
    id: "desktop-delete",
    label: "Delete",
    scope: "row",
    tone: "danger",
    priority: 20,
    requiredPermissions: Object.freeze(["nodes:delete"]),
    permissionRestrictionBehavior: "disabled",
    onInvoke: () => undefined,
  },
  {
    id: "hidden-capability",
    label: "Hidden",
    scope: "bulk",
    requiredSurfaceCapabilities: Object.freeze(["bulk-actions"]),
    capabilityRestrictionBehavior: "hidden",
    onInvoke: () => undefined,
  },
]);

describe("SurfaceActionComponents", () => {
  it("renders visible and disabled actions in button strip", () => {
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:view"]),
      surface: "desktop",
      surfaceCapabilities: Object.freeze(["inline-actions"]),
    });

    const html = renderToStaticMarkup(
      React.createElement(SurfaceActionButtonStrip, {
        actions: descriptors,
        context,
      }),
    );

    expect(html).toContain("ui-action-strip");
    expect(html).toContain("role=\"toolbar\"");
    expect(html).toContain("Refresh");
    expect(html).toContain("Delete");
    expect(html).toContain("disabled");
    expect(html).not.toContain(">Hidden<");
  });

  it("renders menu wrapper with row-scoped actions", () => {
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:view"]),
      surface: "desktop",
      surfaceCapabilities: Object.freeze(["menu-actions"]),
    });

    const html = renderToStaticMarkup(
      React.createElement(SurfaceActionMenu, {
        triggerLabel: "Row actions",
        actions: descriptors,
        context,
        scope: "row",
      }),
    );

    expect(html).toContain("Row actions");
    expect(html).toContain("ui-action-menu__list");
    expect(html).toContain("role=\"menu\"");
    expect(html).toContain("aria-haspopup=\"menu\"");
    expect(html).toContain("role=\"menuitem\"");
    expect(html).toContain("Delete");
    expect(html).not.toContain("Refresh");
  });

  it("renders list wrapper for thin-client action projection", () => {
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:view", "nodes:delete"]),
      surface: "thin-client",
      surfaceCapabilities: Object.freeze(["inline-actions", "bulk-actions"]),
    });
    const responsiveProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 420 });

    const html = renderToStaticMarkup(
      React.createElement(SurfaceActionList, {
        actions: descriptors,
        context,
        responsiveProfile,
      }),
    );

    expect(html).toContain("ui-action-list");
    expect(html).toContain("role=\"toolbar\"");
    expect(html).toContain("ui-action-list--interaction-touch");
    expect(html).toContain("data-action-layout=\"sheet\"");
    expect(html).toContain("Refresh");
    expect(html).toContain("Delete");
  });

  it("renders menu with responsive sheet class when mobile conventions apply", () => {
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["nodes:view"]),
      surface: "mobile",
      surfaceCapabilities: Object.freeze(["menu-actions"]),
    });
    const responsiveProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 390 });

    const html = renderToStaticMarkup(
      React.createElement(SurfaceActionMenu, {
        triggerLabel: "Actions",
        actions: descriptors,
        context,
        responsiveProfile,
      }),
    );

    expect(html).toContain("ui-action-menu--layout-sheet");
    expect(html).toContain("data-action-layout=\"sheet\"");
  });
});
