import { describe, expect, it } from "bun:test";
import { buildAuthorizationSharingDesktopPath, buildAuthorizationSharingThinClientPath } from "../AuthorizationSharingRoutes";

describe("AuthorizationSharingRoutes", () => {
  it("builds desktop and thin-client sharing paths with encoded resource params", () => {
    expect(buildAuthorizationSharingDesktopPath({
      resourceFamily: "asset",
      resourceType: "asset type",
      resourceId: "asset:1",
      workspaceId: "workspace:1",
    })).toBe("/settings/sharing?resourceFamily=asset&resourceType=asset+type&resourceId=asset%3A1&workspaceId=workspace%3A1");

    expect(buildAuthorizationSharingThinClientPath({
      resourceFamily: "workflow",
      resourceType: "workflow",
      resourceId: "wf:2",
    })).toBe("/settings/sharing/thin?resourceFamily=workflow&resourceType=workflow&resourceId=wf%3A2");
  });
});
