import { describe, expect, it } from "bun:test";
import {
  DeploymentTransportSchemaValidationError,
  parseDeploymentHealthResponse,
  parseDeploymentStartRequest,
  parseDeploymentStatusRequest,
} from "../DeploymentTransportSchemaContracts";

describe("DeploymentTransportSchemaContracts", () => {
  it("parses deployment start and status requests", () => {
    const start = parseDeploymentStartRequest({
      requestId: "request:1",
      requestedAt: "2026-04-06T10:00:00.000Z",
      systemPackage: {
        packageId: "package:1",
      },
      target: {
        targetId: "target:1",
        type: "local",
      },
      deploymentConfiguration: {
        configurationId: "config:1",
        packageId: "package:1",
        rootSystemAssetId: "asset:1",
        rootSystemVersionId: "version:1",
        targetId: "target:1",
        targetType: "local",
      },
    });
    expect(start.requestId).toBe("request:1");

    const status = parseDeploymentStatusRequest({
      deploymentId: "deployment:1",
      stateTransitionLimit: 50,
    });
    expect(status.deploymentId).toBe("deployment:1");
  });

  it("parses deployment health responses", () => {
    const health = parseDeploymentHealthResponse({
      ok: true,
      data: {
        deploymentId: "deployment:1",
        status: "healthy",
        evaluatedAt: "2026-04-06T11:00:00.000Z",
        reasons: [],
      },
    });

    expect(health.data?.status).toBe("healthy");
  });

  it("rejects malformed deployment status requests", () => {
    expect(() => parseDeploymentStatusRequest({
      deploymentId: "",
    })).toThrow(DeploymentTransportSchemaValidationError);
  });
});
