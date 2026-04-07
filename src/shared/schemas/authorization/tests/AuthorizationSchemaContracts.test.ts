import { describe, expect, it } from "bun:test";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  AuthorizationPolicyEvaluationRequestDtoSchema,
  AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema,
  AuthorizationResourcePolicyMetadataSchema,
  AuthorizationRoleAssignmentRequestSchema,
  AuthorizationSchemaValidationError,
  AuthorizationSharingGrantChangeRequestSchema,
  AuthorizationVisibilityUpdateRequestSchema,
  parseAuthorizationBulkWorkspaceRoleSharingGrantRequest,
  parseAuthorizationRoleAssignmentRequest,
  parseAuthorizationSharingGrantChangeRequest,
  parseAuthorizationVisibilityUpdateRequest,
} from "../AuthorizationSchemaContracts";

describe("AuthorizationSchemaContracts", () => {
  describe("AuthorizationPolicyEvaluationRequestDtoSchema", () => {
    it("accepts canonical permission-check payloads", () => {
      const parsed = AuthorizationPolicyEvaluationRequestDtoSchema.parse({
        actor: {
          actorUserIdentityId: "user:admin-1",
          activeWorkspaceId: "workspace:alpha",
        },
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset:100",
        },
        requiredPermissionKey: "asset.read",
        asOf: "2026-04-05T12:00:00.000Z",
      });

      expect(parsed.requiredPermissionKey).toBe("asset.read");
      expect(parsed.actor.actorUserIdentityId).toBe("user:admin-1");
    });

    it("rejects payloads without actor principal ids", () => {
      expect(() => AuthorizationPolicyEvaluationRequestDtoSchema.parse({
        actor: {
          activeWorkspaceId: "workspace:alpha",
        },
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset:100",
        },
        requiredPermissionKey: "asset.read",
      })).toThrow("actorUserIdentityId or actorServiceId is required");
    });
  });

  describe("AuthorizationSharingGrantChangeRequestSchema", () => {
    it("accepts shared-visibility upsert grants with user targets", () => {
      const parsed = AuthorizationSharingGrantChangeRequestSchema.parse({
        operation: "upsert",
        actorUserIdentityId: "user:owner-1",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.template,
          resourceType: "template",
          resourceId: "template:1",
        },
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.shared,
        grant: {
          id: "grant:viewer",
          target: {
            kind: "user",
            userId: "user:viewer-1",
          },
          permissionKeys: ["template.read"],
        },
      });

      expect(parsed.operation).toBe("upsert");
      expect(parsed.grant.target.kind).toBe("user");
    });

    it("rejects workspace-oriented target with mismatched workspace scope", () => {
      expect(() => AuthorizationSharingGrantChangeRequestSchema.parse({
        operation: "upsert",
        actorUserIdentityId: "user:owner-1",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.template,
          resourceType: "template",
          resourceId: "template:1",
        },
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.shared,
        grant: {
          id: "grant:role",
          target: {
            kind: "workspace-role",
            workspaceId: "workspace:beta",
            roleKey: "viewer",
          },
          permissionKeys: ["template.read"],
        },
      })).toThrow("must match request workspaceId");
    });

    it("rejects public targets for non-published visibility", () => {
      expect(() => parseAuthorizationSharingGrantChangeRequest({
        operation: "upsert",
        actorUserIdentityId: "user:owner-1",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.artifact,
          resourceType: "artifact",
          resourceId: "artifact:1",
        },
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.shared,
        grant: {
          id: "grant:public",
          target: {
            kind: "public",
          },
          permissionKeys: ["artifact.read"],
        },
      })).toThrow(AuthorizationSchemaValidationError);
    });
  });

  describe("AuthorizationVisibilityUpdateRequestSchema", () => {
    it("accepts published visibility updates with public sharing grants", () => {
      const parsed = AuthorizationVisibilityUpdateRequestSchema.parse({
        actorUserIdentityId: "user:owner-1",
        subject: {
          resourceFamily: AuthorizationResourceFamilies.artifact,
          resourceType: "artifact",
          resourceId: "artifact:published-1",
        },
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.published,
        sharingPolicyMode: SharingPolicyModes.published,
        sharingGrants: [
          {
            id: "grant:public",
            target: {
              kind: "public",
            },
            permissionKeys: ["artifact.read"],
          },
        ],
        isPublishedCapable: true,
        publishedAt: "2026-04-05T12:00:00.000Z",
      });

      expect(parsed.visibility).toBe(ResourceVisibilities.published);
      expect(parsed.sharingGrants).toHaveLength(1);
    });

    it("rejects workspace visibility without workspace scope", () => {
      expect(() => AuthorizationVisibilityUpdateRequestSchema.parse({
        actorUserIdentityId: "user:owner-1",
        subject: {
          resourceFamily: AuthorizationResourceFamilies.workflow,
          resourceType: "workflow",
          resourceId: "workflow:1",
        },
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
      })).toThrow("Workspace visibility requires workspaceId");
    });

    it("returns typed validation details when visibility rules are violated", () => {
      expect(() => parseAuthorizationVisibilityUpdateRequest({
        actorUserIdentityId: "user:owner-1",
        subject: {
          resourceFamily: AuthorizationResourceFamilies.template,
          resourceType: "template",
          resourceId: "template:shared-1",
        },
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        sharingGrants: [],
      })).toThrow(AuthorizationSchemaValidationError);

      try {
        parseAuthorizationVisibilityUpdateRequest({
          actorUserIdentityId: "user:owner-1",
          subject: {
            resourceFamily: AuthorizationResourceFamilies.template,
            resourceType: "template",
            resourceId: "template:shared-1",
          },
          workspaceId: "workspace:alpha",
          visibility: ResourceVisibilities.shared,
          sharingPolicyMode: SharingPolicyModes.workspaceMembers,
          sharingGrants: [],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AuthorizationSchemaValidationError);
        if (!(error instanceof AuthorizationSchemaValidationError)) {
          return;
        }

        expect(error.schemaName).toBe("AuthorizationVisibilityUpdateRequest");
        expect(error.issues.some((issue) => issue.path === "sharingPolicyMode")).toBeTrue();
      }
    });
  });

  describe("AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema", () => {
    it("accepts canonical bulk workspace-role grant requests", () => {
      const parsed = AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema.parse({
        actorUserIdentityId: "user:owner-1",
        workspaceId: "workspace:alpha",
        roleKey: "viewer",
        resources: [
          {
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: "asset",
            resourceId: "asset:1",
          },
          {
            resourceFamily: AuthorizationResourceFamilies.template,
            resourceType: "template",
            resourceId: "template:2",
          },
        ],
        permissionKeys: ["asset.read"],
      });

      expect(parsed.resources).toHaveLength(2);
      expect(parsed.roleKey).toBe("viewer");
    });

    it("rejects duplicate resources in bulk requests", () => {
      expect(() => parseAuthorizationBulkWorkspaceRoleSharingGrantRequest({
        actorUserIdentityId: "user:owner-1",
        workspaceId: "workspace:alpha",
        roleKey: "viewer",
        resources: [
          {
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: "asset",
            resourceId: "asset:1",
          },
          {
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: "asset",
            resourceId: "asset:1",
          },
        ],
        permissionKeys: ["asset.read"],
      })).toThrow(AuthorizationSchemaValidationError);
    });
  });

  describe("AuthorizationRoleAssignmentRequestSchema", () => {
    it("accepts assign/reassign/revoke role requests", () => {
      const assign = AuthorizationRoleAssignmentRequestSchema.parse({
        operation: "assign",
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:admin-1",
        targetUserIdentityId: "user:member-1",
        roleKey: "member",
      });

      const reassign = AuthorizationRoleAssignmentRequestSchema.parse({
        operation: "reassign",
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:admin-1",
        targetUserIdentityId: "user:member-1",
        fromRoleKey: "member",
        toRoleKey: "viewer",
      });

      const revoke = AuthorizationRoleAssignmentRequestSchema.parse({
        operation: "revoke",
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:admin-1",
        targetUserIdentityId: "user:member-1",
        roleKey: "viewer",
      });

      expect(assign.operation).toBe("assign");
      expect(reassign.operation).toBe("reassign");
      expect(revoke.operation).toBe("revoke");
    });

    it("rejects role reassignment with identical fromRoleKey/toRoleKey", () => {
      expect(() => parseAuthorizationRoleAssignmentRequest({
        operation: "reassign",
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:admin-1",
        targetUserIdentityId: "user:member-1",
        fromRoleKey: "member",
        toRoleKey: "member",
      })).toThrow("different fromRoleKey and toRoleKey");
    });

    it("rejects owner role operations in assignment schema", () => {
      expect(() => AuthorizationRoleAssignmentRequestSchema.parse({
        operation: "assign",
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:admin-1",
        targetUserIdentityId: "user:member-1",
        roleKey: "owner",
      })).toThrow();
    });
  });

  describe("AuthorizationResourcePolicyMetadataSchema", () => {
    it("accepts workspace-scoped shared metadata records", () => {
      const parsed = AuthorizationResourcePolicyMetadataSchema.parse({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:201",
        ownerUserIdentityId: "user:owner-1",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      });

      expect(parsed.visibility).toBe(ResourceVisibilities.shared);
      expect(parsed.workspaceId).toBe("workspace:alpha");
    });

    it("rejects metadata with invalid ownership and visibility combinations", () => {
      expect(() => AuthorizationResourcePolicyMetadataSchema.parse({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:201",
        ownerUserIdentityId: "user:owner-1",
        ownershipScope: ResourceOwnershipScopes.userPrivate,
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      })).toThrow("User-private ownership cannot include workspaceId");
    });

    it("rejects published visibility without publication metadata", () => {
      expect(() => AuthorizationResourcePolicyMetadataSchema.parse({
        resourceFamily: AuthorizationResourceFamilies.artifact,
        resourceType: "artifact",
        resourceId: "artifact:201",
        ownerUserIdentityId: "user:owner-1",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.published,
        sharingPolicyMode: SharingPolicyModes.published,
        allowResharing: true,
        isPublishedCapable: false,
      })).toThrow("isPublishedCapable=true");
    });
  });
});

