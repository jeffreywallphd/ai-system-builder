import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createRuntimeCapabilityStatus, type RuntimeCapabilityStatus } from "../../../../contracts/runtime";
import type { RuntimeReadinessPort } from "../../../ports/runtime";
import {
  RuntimeCapabilityGuardService,
  RuntimeCapabilityUnavailableError,
} from "../runtime-capability-guard.service";

function status(value: RuntimeCapabilityStatus["status"]): RuntimeCapabilityStatus {
  return createRuntimeCapabilityStatus({
    capabilityId: "image-generation",
    status: value,
    summary: `image generation is ${value}`,
    reason: value === "ready" ? undefined : {
      code: `runtime.test.${value}`,
      message: `unsafe provider message /tmp/secret ${process.env.PATH}`,
      category: value === "not-installed" || value === "installing" ? "installation" : "unavailable",
      retryable: true,
    },
    recommendedActions: value === "not-installed" ? ["install"] : value === "starting" || value === "installing" ? ["wait"] : ["retry"],
  });
}

function readinessPort(capabilityStatus: RuntimeCapabilityStatus): RuntimeReadinessPort {
  return {
    getCapabilityStatus: testDouble.fn(async () => capabilityStatus),
    getReadinessSnapshot: testDouble.fn(async () => ({
      status: capabilityStatus.status,
      healthy: capabilityStatus.healthy === true,
      available: capabilityStatus.available === true,
      capabilities: [capabilityStatus],
    })),
  };
}

describe("RuntimeCapabilityGuardService", () => {
  it("allows ready capabilities and only reads readiness", async () => {
    const port = readinessPort(status("ready"));
    const guard = new RuntimeCapabilityGuardService(port);

    const ready = await guard.requireCapabilityReady("image-generation");
    expect(ready).toMatchObject({ status: "ready" });
    expect(port.getCapabilityStatus).toHaveBeenCalledWith("image-generation");
    expect(port.getReadinessSnapshot).not.toHaveBeenCalled();
  });

  it("rejects degraded by default", async () => {
    const guard = new RuntimeCapabilityGuardService(readinessPort(status("degraded")));
    await guard.requireCapabilityReady("image-generation").catch((error) => {
      expect(error).toMatchObject({ code: "unavailable", capabilityStatus: { status: "degraded" } });
    });
  });

  it("allows degraded only when explicitly configured", async () => {
    const guard = new RuntimeCapabilityGuardService(readinessPort(status("degraded")));
    const degraded = await guard.requireCapabilityReady("image-generation", { allowDegraded: true });
    expect(degraded).toMatchObject({ status: "degraded" });
  });

  for (const blocked of ["starting", "installing", "not-installed", "unavailable", "unknown", "failed"] as const) {
    it(`rejects ${blocked} with safe capability details`, async () => {
      const guard = new RuntimeCapabilityGuardService(readinessPort(status(blocked)));
      await guard.requireCapabilityReady("image-generation").catch((error) => {
        expect(error instanceof RuntimeCapabilityUnavailableError).toBe(true);
        expect(error).toMatchObject({
          code: "unavailable",
          capabilityStatus: { capabilityId: "image-generation", status: blocked },
          details: { capabilityId: "image-generation", status: blocked, reason: { code: `runtime.test.${blocked}` } },
        });
        expect(JSON.stringify(error.details)).not.toContain("/tmp/secret");
      });
    });
  }
});
