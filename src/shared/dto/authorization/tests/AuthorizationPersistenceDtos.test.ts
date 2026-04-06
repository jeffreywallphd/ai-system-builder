import { describe, expect, it } from "bun:test";
import { AuthorizationResourceFamilies } from "../../../../domain/authorization/AuthorizationPermissionCatalog";
import {
  normalizeAuthorizationMutationOperationKey,
  toAuthorizationResourceLookupKey,
  toAuthorizationSharingSubjectLookupKey,
} from "../AuthorizationPersistenceDtos";

describe("AuthorizationPersistenceDtos", () => {
  it("builds deterministic resource lookup keys for workspace-aware policy records", () => {
    const key = toAuthorizationResourceLookupKey({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-101",
    });

    expect(key).toBe("asset:asset:asset-101");
  });

  it("builds sharing-subject lookup keys for all supported subject kinds", () => {
    expect(toAuthorizationSharingSubjectLookupKey({
      kind: "user",
      userIdentityId: "user-1",
    })).toBe("user:user-1");
    expect(toAuthorizationSharingSubjectLookupKey({
      kind: "workspace",
      workspaceId: "workspace-1",
    })).toBe("workspace:workspace-1");
    expect(toAuthorizationSharingSubjectLookupKey({
      kind: "workspace-role",
      workspaceId: "workspace-1",
      roleKey: "admin",
    })).toBe("workspace-role:workspace-1:admin");
    expect(toAuthorizationSharingSubjectLookupKey({
      kind: "public",
    })).toBe("public");
  });

  it("rejects empty idempotency operation keys", () => {
    expect(() => normalizeAuthorizationMutationOperationKey("   ")).toThrow(
      "Authorization persistence mutation operationKey is required.",
    );
    expect(normalizeAuthorizationMutationOperationKey("  OP-101  ")).toBe("op-101");
  });
});
