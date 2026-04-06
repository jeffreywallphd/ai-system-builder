import { describe, expect, it } from "bun:test";
import {
  createMixedTenancyMetadata,
  createNodeTenancyMetadata,
  createPlatformTenancyMetadata,
  createUserTenancyMetadata,
  createWorkspaceTenancyMetadata,
} from "../PersistenceTenancyMetadataFactory";

describe("PersistenceTenancyMetadataFactory", () => {
  it("creates tenancy metadata for each canonical scope", () => {
    expect(createPlatformTenancyMetadata()).toEqual({ scope: "platform" });
    expect(createWorkspaceTenancyMetadata("workspace-1")).toEqual({
      scope: "workspace",
      workspaceId: "workspace-1",
    });
    expect(createUserTenancyMetadata("user-1")).toEqual({
      scope: "user",
      userIdentityId: "user-1",
    });
    expect(createNodeTenancyMetadata("node-1")).toEqual({
      scope: "node",
      nodeId: "node-1",
    });
    expect(createMixedTenancyMetadata({ workspaceId: "w-1", userIdentityId: "u-1" })).toEqual({
      scope: "mixed",
      workspaceId: "w-1",
      userIdentityId: "u-1",
      nodeId: undefined,
    });
  });
});
