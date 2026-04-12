import { describe, expect, it } from "bun:test";
import { DeploymentTransportRoutes } from "../DeploymentTransportContracts";

describe("DeploymentTransportContracts", () => {
  it("defines canonical deployment transport routes", () => {
    expect(DeploymentTransportRoutes.startDeployment).toBe("/api/v1/deployment/start");
    expect(DeploymentTransportRoutes.getDeploymentStatus).toContain(":deploymentId");
    expect(DeploymentTransportRoutes.rollbackDeployment).toBe("/api/v1/deployment/rollback");
  });
});
