import { describe, expect, it } from "bun:test";
import {
  createDeploymentPolicyPersistenceScope,
  DeploymentPolicyPersistenceScopeKinds,
  normalizeDeploymentPolicyMutationOperationKey,
} from "../DeploymentPolicyAdministrationPersistenceDtos";

describe("DeploymentPolicyAdministrationPersistenceDtos", () => {
  it("normalizes and validates deployment policy persistence scopes", () => {
    const scope = createDeploymentPolicyPersistenceScope({
      scopeId: "  Platform:Default  ",
    });

    expect(scope.kind).toBe(DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope);
    expect(scope.scopeId).toBe("platform:default");
  });

  it("normalizes mutation operation keys and rejects empty values", () => {
    expect(normalizeDeploymentPolicyMutationOperationKey("  deployment:policy:op:1  "))
      .toBe("deployment:policy:op:1");
    expect(() => normalizeDeploymentPolicyMutationOperationKey("   "))
      .toThrow("operationKey is required");
  });
});

