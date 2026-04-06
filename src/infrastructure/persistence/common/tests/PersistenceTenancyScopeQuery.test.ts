import { describe, expect, it } from "bun:test";
import {
  applyTenancyScopeFilter,
  normalizeEmailTenancyLookup,
} from "../PersistenceTenancyScopeQuery";
import { createSqliteWhereBuilder } from "../SqliteQueryHelpers";

describe("PersistenceTenancyScopeQuery", () => {
  it("applies tenancy scope filters to where builders", () => {
    const builder = createSqliteWhereBuilder();
    applyTenancyScopeFilter(builder, {
      workspaceId: " workspace-alpha ",
      userIdentityId: " user-owner ",
    }, {
      workspaceId: "workspace_id",
      userIdentityId: "user_identity_id",
    });

    expect(builder.build()).toEqual({
      sql: "WHERE workspace_id = ? AND user_identity_id = ?",
      params: ["workspace-alpha", "user-owner"],
    });
  });

  it("normalizes tenancy email lookups consistently", () => {
    expect(normalizeEmailTenancyLookup(" User@Example.Com ")).toBe("user@example.com");
  });
});
