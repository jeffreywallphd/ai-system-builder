import { describe, expect, it } from "bun:test";
import {
  IdentityCredentialMaterialStatuses,
  IdentityPrincipalLookupKinds,
  normalizeIdentityPersistenceOperationKey,
} from "../IdentityPersistenceDtos";

describe("identity persistence DTO contracts", () => {
  it("defines stable identity lookup and credential material vocabularies", () => {
    expect(Object.values(IdentityPrincipalLookupKinds)).toEqual(["username", "email"]);
    expect(Object.values(IdentityCredentialMaterialStatuses)).toEqual([
      "active",
      "superseded",
      "revoked",
      "expired",
    ]);
  });

  it("normalizes operation keys for idempotent mutation semantics", () => {
    expect(normalizeIdentityPersistenceOperationKey("  OP-Identity-Session-001  ")).toBe("op-identity-session-001");
  });
});
