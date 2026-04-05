import { describe, expect, it } from "bun:test";
import {
  WorkspaceOwnershipError,
  WorkspaceVisibilities,
  createWorkspaceOwnershipMetadata,
  rehydrateWorkspaceOwnershipMetadata,
  touchWorkspaceOwnershipMetadata,
  withWorkspaceOwnershipSharingPolicy,
  withWorkspaceScopedOwnership,
} from "../WorkspaceOwnership";

describe("WorkspaceOwnership", () => {
  it("creates canonical ownership metadata with default visibility", () => {
    const ownership = createWorkspaceOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(ownership.workspaceId).toBe("workspace-alpha");
    expect(ownership.visibility).toBe(WorkspaceVisibilities.private);
    expect(ownership.lastModifiedAt).toBe("2026-04-05T12:00:00.000Z");
  });

  it("supports sharing policy references and tracks attribution updates", () => {
    const ownership = createWorkspaceOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      visibility: WorkspaceVisibilities.team,
      sharingPolicy: {
        policyId: "sharing-policy-v1",
      },
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    const updated = withWorkspaceOwnershipSharingPolicy(
      ownership,
      {
        policyId: "sharing-policy-v2",
        policyVersion: "2026.04",
      },
      "user-admin",
      new Date("2026-04-05T12:10:00.000Z"),
    );

    expect(updated.sharingPolicy?.policyId).toBe("sharing-policy-v2");
    expect(updated.sharingPolicy?.policyVersion).toBe("2026.04");
    expect(updated.lastModifiedBy).toBe("user-admin");
    expect(updated.lastModifiedAt).toBe("2026-04-05T12:10:00.000Z");
  });

  it("rehydrates persisted ownership without forcing owner to equal createdBy", () => {
    const ownership = rehydrateWorkspaceOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-next-owner",
      visibility: WorkspaceVisibilities.team,
      createdBy: "user-original-owner",
      lastModifiedBy: "user-original-owner",
      createdAt: "2026-04-05T12:00:00.000Z",
      lastModifiedAt: "2026-04-05T12:05:00.000Z",
    });

    const touched = touchWorkspaceOwnershipMetadata(
      ownership,
      "user-next-owner",
      new Date("2026-04-05T12:20:00.000Z"),
    );

    expect(ownership.ownerUserId).toBe("user-next-owner");
    expect(ownership.createdBy).toBe("user-original-owner");
    expect(touched.lastModifiedBy).toBe("user-next-owner");
    expect(touched.lastModifiedAt).toBe("2026-04-05T12:20:00.000Z");
  });

  it("enforces workspace linkage composition for protected resources", () => {
    const ownership = createWorkspaceOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
    });

    const attached = withWorkspaceScopedOwnership(
      {
        id: "resource-1",
        workspaceId: "workspace-alpha",
      },
      ownership,
    );

    expect(attached.ownership.workspaceId).toBe("workspace-alpha");
    expect(() => withWorkspaceScopedOwnership(
      {
        id: "resource-2",
        workspaceId: "workspace-beta",
      },
      ownership,
    )).toThrow(WorkspaceOwnershipError);
  });
});
