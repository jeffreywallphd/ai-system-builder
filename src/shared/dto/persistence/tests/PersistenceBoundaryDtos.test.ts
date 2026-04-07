import { describe, expect, it } from "bun:test";
import {
  PersistenceSensitiveFieldProtections,
  PersistenceTenancyScopes,
  normalizePersistenceOperationKey,
  toPersistenceTenancyLookupKey,
} from "../PersistenceBoundaryDtos";

describe("PersistenceBoundaryDtos", () => {
  it("exposes stable tenancy and sensitivity vocabularies", () => {
    expect(Object.values(PersistenceTenancyScopes)).toEqual([
      "platform",
      "workspace",
      "user",
      "node",
      "mixed",
    ]);
    expect(Object.values(PersistenceSensitiveFieldProtections)).toEqual([
      "none",
      "hashed",
      "encrypted",
      "tokenized",
      "redacted",
    ]);
  });

  it("normalizes persistence operation keys and builds tenancy lookup keys", () => {
    expect(normalizePersistenceOperationKey("  OP-Workspace-Create-001  ")).toBe("op-workspace-create-001");
    expect(toPersistenceTenancyLookupKey({
      scope: PersistenceTenancyScopes.workspace,
      workspaceId: "workspace-1",
    })).toBe("workspace:workspace-1");
  });

  it("rejects empty operation keys", () => {
    expect(() => normalizePersistenceOperationKey("   ")).toThrow("operationKey");
  });
});
