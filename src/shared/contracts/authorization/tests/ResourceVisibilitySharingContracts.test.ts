import { describe, expect, it } from "bun:test";
import {
  ProtectedResourceAuthorizationContractError,
  ProtectedResourceFamilies,
  ProtectedResourceSharingPolicyModes,
  ProtectedResourceVisibilities,
  adaptLegacyProtectedResourceAuthorizationContract,
  createProtectedResourceAuthorizationContract,
  createUserSharingTarget,
  createWorkspaceRoleSharingTarget,
  rehydrateProtectedResourceAuthorizationFromDto,
  toProtectedResourceAuthorizationDto,
} from "../ResourceVisibilitySharingContracts";

describe("ResourceVisibilitySharingContracts", () => {
  it("creates a canonical shared resource contract with explicit user and role sharing targets", () => {
    const contract = createProtectedResourceAuthorizationContract({
      subject: {
        resourceFamily: ProtectedResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:001",
      },
      workspaceId: "workspace:alpha",
      ownerUserId: "user:owner-1",
      visibility: ProtectedResourceVisibilities.shared,
      sharingPolicy: {
        mode: ProtectedResourceSharingPolicyModes.explicit,
        grants: [
          {
            id: "share:user",
            target: createUserSharingTarget("user:viewer-1"),
            permissionKeys: ["asset.read"],
          },
          {
            id: "share:role",
            target: createWorkspaceRoleSharingTarget("workspace:alpha", "viewer"),
            permissionKeys: ["asset.read"],
          },
        ],
      },
      createdBy: "user:owner-1",
      lastModifiedBy: "user:admin-1",
    });

    expect(contract.visibility).toBe(ProtectedResourceVisibilities.shared);
    expect(contract.sharingPolicy.grants).toHaveLength(2);
    expect(contract.lastModifiedBy).toBe("user:admin-1");
  });

  it("rejects shared visibility without explicit sharing grants", () => {
    expect(() => createProtectedResourceAuthorizationContract({
      subject: {
        resourceFamily: ProtectedResourceFamilies.workflow,
        resourceType: "workflow",
        resourceId: "workflow:1",
      },
      workspaceId: "workspace:alpha",
      ownerUserId: "user:owner-1",
      visibility: ProtectedResourceVisibilities.shared,
      sharingPolicy: {
        mode: ProtectedResourceSharingPolicyModes.explicit,
        grants: [],
      },
      createdBy: "user:owner-1",
    })).toThrow("Shared visibility requires at least one explicit sharing grant");
  });

  it("rejects workspace-role sharing targets for resources without workspaceId", () => {
    expect(() => createProtectedResourceAuthorizationContract({
      subject: {
        resourceFamily: ProtectedResourceFamilies.template,
        resourceType: "template",
        resourceId: "template:1",
      },
      ownerUserId: "user:owner-1",
      visibility: ProtectedResourceVisibilities.shared,
      sharingPolicy: {
        mode: ProtectedResourceSharingPolicyModes.explicit,
        grants: [
          {
            id: "share:role",
            target: createWorkspaceRoleSharingTarget("workspace:alpha", "viewer"),
            permissionKeys: ["template.read"],
          },
        ],
      },
      createdBy: "user:owner-1",
    })).toThrow(ProtectedResourceAuthorizationContractError);
  });

  it("serializes and rehydrates contracts via DTO shape", () => {
    const contract = createProtectedResourceAuthorizationContract({
      subject: {
        resourceFamily: ProtectedResourceFamilies.artifact,
        resourceType: "artifact",
        resourceId: "artifact:public-1",
      },
      workspaceId: "workspace:alpha",
      ownerUserId: "user:owner-1",
      visibility: ProtectedResourceVisibilities.published,
      sharingPolicy: {
        mode: ProtectedResourceSharingPolicyModes.published,
        grants: [
          {
            id: "share:public",
            target: {
              kind: "public",
            },
            permissionKeys: ["artifact.read"],
          },
        ],
      },
      createdBy: "user:owner-1",
      isPublishedCapable: true,
      publishedAt: "2026-04-05T12:00:00.000Z",
    });

    const dto = toProtectedResourceAuthorizationDto(contract);
    const rehydrated = rehydrateProtectedResourceAuthorizationFromDto(dto);

    expect(rehydrated).toEqual(contract);
  });

  it("adapts legacy resource ownership fields by defaulting owner and modifier attribution", () => {
    const adapted = adaptLegacyProtectedResourceAuthorizationContract({
      subject: {
        resourceFamily: ProtectedResourceFamilies.system,
        resourceType: "system",
        resourceId: "system:legacy-1",
      },
      createdBy: "user:creator-1",
    });

    expect(adapted.ownerUserId).toBe("user:creator-1");
    expect(adapted.lastModifiedBy).toBe("user:creator-1");
    expect(adapted.visibility).toBe(ProtectedResourceVisibilities.private);
    expect(adapted.sharingPolicy.mode).toBe(ProtectedResourceSharingPolicyModes.ownerOnly);
  });
});
