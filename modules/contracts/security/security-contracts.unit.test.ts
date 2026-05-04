import { describe, expect, it } from "../../testing/node-test";
import { createAnonymousAuthContext, createSecurityError, missingSecurityScopes } from "./index";

describe("security contracts", () => {
  it("identifies missing scopes", () => {
    const missing = missingSecurityScopes(["artifact:read"], ["artifact:read", "runtime:admin"]);
    expect(missing).toEqual(["runtime:admin"]);
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
