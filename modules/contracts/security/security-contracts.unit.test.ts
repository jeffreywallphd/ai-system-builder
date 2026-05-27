import { describe, expect, it } from "../../testing/node-test";
import { createAnonymousAuthContext, createSecurityError, missingSecurityScopes, SECURITY_SCOPES } from "./index";

describe("security contracts", () => {
  it("identifies missing scopes", () => {
    const missing = missingSecurityScopes(["artifact:read"], ["artifact:read", "runtime:admin"]);
    expect(missing).toEqual(["runtime:admin"]);
  });

  it("declares workspace read and write scopes", () => {
    expect(SECURITY_SCOPES).toContain("workspace:read");
    expect(SECURITY_SCOPES).toContain("workspace:write");
  });

  it("creates anonymous auth context", () => {
    const context = createAnonymousAuthContext();
    expect(context.authenticated).toBe(false);
    expect(context.principal.kind).toBe("anonymous");
    expect(context.principal.scopes).toEqual([]);
  });

  it("creates security error helper output", () => {
    const error = createSecurityError("security.forbidden", "Nope");
    expect(error.code).toBe("security.forbidden");
    expect(error.message).toBe("Nope");
  });
});
