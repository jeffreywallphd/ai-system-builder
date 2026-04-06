import { describe, expect, it } from "bun:test";
import { PersistenceTenancyScopes } from "../../../../shared/dto/persistence/PersistenceBoundaryDtos";
import {
  createPersistenceTenancyMetadataFromLookup,
  normalizePersistenceLookup,
  normalizePersistenceLookupLowercase,
  parseOptionalPersistenceObjectJson,
  toPersistenceTenancyScopeFields,
} from "../PersistenceMapperUtilities";

describe("PersistenceMapperUtilities", () => {
  it("normalizes optional lookup values", () => {
    expect(normalizePersistenceLookup("  workspace-alpha ")).toBe("workspace-alpha");
    expect(normalizePersistenceLookup("   ")).toBeUndefined();
    expect(normalizePersistenceLookup(null)).toBeUndefined();
    expect(normalizePersistenceLookupLowercase(" User@Example.Com ")).toBe("user@example.com");
  });

  it("parses optional object JSON payloads", () => {
    expect(parseOptionalPersistenceObjectJson('{"a":1}', "test")).toEqual({ a: 1 });
    expect(parseOptionalPersistenceObjectJson(undefined, "test")).toBeUndefined();
    expect(() => parseOptionalPersistenceObjectJson("[]", "test")).toThrow("must be an object");
  });

  it("creates tenancy metadata and scope fields from lookup inputs", () => {
    const mixed = createPersistenceTenancyMetadataFromLookup({
      workspaceId: " workspace-alpha ",
      userIdentityId: " user-owner ",
    });
    expect(mixed.scope).toBe(PersistenceTenancyScopes.mixed);
    expect(toPersistenceTenancyScopeFields(mixed)).toEqual({
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      nodeId: undefined,
    });

    const platform = createPersistenceTenancyMetadataFromLookup({});
    expect(platform.scope).toBe(PersistenceTenancyScopes.platform);
  });
});
