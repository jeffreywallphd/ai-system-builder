import { describe, expect, it } from "bun:test";
import { TenantExecutionIsolationPolicy } from "../TenantExecutionIsolationPolicy";

describe("TenantExecutionIsolationPolicy", () => {
  it("allows access when tenant context matches", () => {
    const policy = new TenantExecutionIsolationPolicy();
    const decision = policy.evaluate({
      access: { tenant: { tenantId: "tenant-a", source: "caller-context" } },
      resourceTenantId: "tenant-a",
    });
    expect(decision.allowed).toBeTrue();
  });

  it("blocks cross-tenant access and tenant-scoped resources without tenant context", () => {
    const policy = new TenantExecutionIsolationPolicy();
    const deniedCrossTenant = policy.evaluate({
      access: { tenant: { tenantId: "tenant-b", source: "caller-context" } },
      resourceTenantId: "tenant-a",
    });
    expect(deniedCrossTenant.allowed).toBeFalse();

    const deniedMissingContext = policy.evaluate({
      access: {},
      resourceTenantId: "tenant-a",
    });
    expect(deniedMissingContext.allowed).toBeFalse();
  });
});

