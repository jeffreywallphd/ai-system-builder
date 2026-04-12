import { describe, expect, it } from "bun:test";
import { DeploymentPolicyWriteTransportRoutes } from "../DeploymentPolicyWriteContracts";

describe("DeploymentPolicyWriteContracts", () => {
  it("defines canonical authoritative deployment policy write routes", () => {
    expect(DeploymentPolicyWriteTransportRoutes.updateActiveProfile).toBe("/api/v1/deployment/policy/active-profile");
    expect(DeploymentPolicyWriteTransportRoutes.applyOverrides).toBe("/api/v1/deployment/policy/overrides");
  });
});
