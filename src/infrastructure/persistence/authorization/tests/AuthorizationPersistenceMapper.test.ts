import { describe, expect, it } from "bun:test";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
  SharingSubjectKinds,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  mapResourcePolicyMetadataRowToRecord,
  mapRoleAssignmentRowToRecord,
  mapSharingGrantRowToRecord,
  normalizeAuthorizationLookup,
  type AuthorizationResourcePolicyMetadataRow,
  type AuthorizationRoleAssignmentRow,
  type AuthorizationSharingGrantRow,
} from "../AuthorizationPersistenceMapper";

describe("AuthorizationPersistenceMapper", () => {
  it("maps role assignment rows to persistence records", () => {
    const row: AuthorizationRoleAssignmentRow = {
      role_assignment_id: "role-assignment:alpha",
      actor_user_identity_id: "user:member",
      role_key: "member",
      scope: RoleAssignmentScopes.workspace,
      workspace_id: "workspace:alpha",
      resource_family: null,
      resource_type: null,
      resource_id: null,
      status: RoleAssignmentStatuses.active,
      assigned_at: "2026-04-05T12:00:00.000Z",
      assigned_by_user_identity_id: "user:owner",
      revoked_at: null,
      revoked_by_user_identity_id: null,
      created_at: "2026-04-05T12:00:00.000Z",
      created_by: "user:owner",
      last_modified_at: "2026-04-05T12:00:00.000Z",
      last_modified_by: "user:owner",
      revision: 3,
    };

    const mapped = mapRoleAssignmentRowToRecord(row);
    expect(mapped.id).toBe("role-assignment:alpha");
    expect(mapped.scope).toBe(RoleAssignmentScopes.workspace);
    expect(mapped.workspaceId).toBe("workspace:alpha");
    expect(mapped.revision).toBe(3);
  });

  it("maps sharing grant rows to persistence records", () => {
    const row: AuthorizationSharingGrantRow = {
      sharing_grant_id: "sharing-grant:alpha",
      resource_family: AuthorizationResourceFamilies.asset,
      resource_type: "asset",
      resource_id: "asset:001",
      workspace_id: "workspace:alpha",
      subject_kind: SharingSubjectKinds.workspaceRole,
      subject_user_identity_id: null,
      subject_workspace_id: "workspace:alpha",
      subject_role_key: "viewer",
      permission_keys_json: "[\"asset.read\",\"asset.read\"]",
      granted_at: "2026-04-05T12:00:00.000Z",
      granted_by_user_identity_id: "user:owner",
      expires_at: null,
      revoked_at: null,
      revoked_by_user_identity_id: null,
      created_at: "2026-04-05T12:00:00.000Z",
      created_by: "user:owner",
      last_modified_at: "2026-04-05T12:00:00.000Z",
      last_modified_by: "user:owner",
      revision: 2,
    };

    const mapped = mapSharingGrantRowToRecord(row);
    expect(mapped.resourceFamily).toBe(AuthorizationResourceFamilies.asset);
    expect(mapped.subject.kind).toBe(SharingSubjectKinds.workspaceRole);
    expect(mapped.permissionKeys).toEqual(["asset.read"]);
  });

  it("maps resource policy rows and normalizes lookup values", () => {
    const row: AuthorizationResourcePolicyMetadataRow = {
      resource_family: AuthorizationResourceFamilies.workflow,
      resource_type: "workflow",
      resource_id: "workflow:alpha",
      owner_user_identity_id: "user:owner",
      ownership_scope: ResourceOwnershipScopes.workspace,
      workspace_id: "workspace:alpha",
      visibility: ResourceVisibilities.shared,
      sharing_policy_mode: SharingPolicyModes.explicit,
      allow_resharing: 1,
      is_published_capable: 1,
      published_at: null,
      deleted_at: null,
      deleted_by_user_identity_id: null,
      created_at: "2026-04-05T12:00:00.000Z",
      created_by: "user:owner",
      last_modified_at: "2026-04-05T12:00:00.000Z",
      last_modified_by: "user:owner",
      revision: 1,
    };

    const mapped = mapResourcePolicyMetadataRowToRecord(row);
    expect(mapped.resourceFamily).toBe(AuthorizationResourceFamilies.workflow);
    expect(mapped.allowResharing).toBeTrue();
    expect(normalizeAuthorizationLookup("  workspace:alpha  ")).toBe("workspace:alpha");
    expect(normalizeAuthorizationLookup("   ")).toBeUndefined();
  });
});

