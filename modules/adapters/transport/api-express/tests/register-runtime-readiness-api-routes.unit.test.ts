import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createRuntimeCapabilityStatus } from "../../../../contracts/runtime";
import { registerRuntimeReadinessApiRoutes, type ExpressRoutePort } from "../runtime-readiness/registerRuntimeReadinessApiRoutes";

function response() {
  const json = testDouble.fn();
  const status = testDouble.fn();
  const res: any = { status: status.mockImplementation(() => res), json };
  return { res, json, status };
}

describe("registerRuntimeReadinessApiRoutes", () => {
  it("returns a host-scoped readiness snapshot with request metadata", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { get: testDouble.fn((path, handler) => handlers.set(path, handler)) };
    const capability = createRuntimeCapabilityStatus({ capabilityId: "python-runtime", status: "ready" });
    const runtimeReadiness = {
      getReadinessSnapshot: testDouble.fn(async () => ({
        status: "ready" as const,
        healthy: true,
        available: true,
        capabilities: [capability],
      })),
      getCapabilityStatus: testDouble.fn(),
    };

    registerRuntimeReadinessApiRoutes({ app, runtimeReadiness });
    const { res, status, json } = response();
    await handlers.get("/api/runtime/readiness")({ headers: { "x-request-id": "r1", "x-correlation-id": "c1" } }, res);

    expect(status).toHaveBeenCalledWith(200);
    const body = json.mock.calls[0]?.[0];
    expect(body).toMatchObject({
      ok: true,
      operation: "runtime.readiness-read",
      requestId: "r1",
      correlationId: "c1",
      value: { capabilities: [capability] },
    });
  });

  it("returns one capability status after normalizing the route parameter", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { get: testDouble.fn((path, handler) => handlers.set(path, handler)) };
    const capability = createRuntimeCapabilityStatus({ capabilityId: "python-runtime", status: "unavailable" });
    const runtimeReadiness = {
      getReadinessSnapshot: testDouble.fn(),
      getCapabilityStatus: testDouble.fn(async () => capability),
    };

    registerRuntimeReadinessApiRoutes({ app, runtimeReadiness });
    const { res, status, json } = response();
    await handlers.get("/api/runtime/capabilities/:capabilityId")({ params: { capabilityId: " PYTHON-RUNTIME " }, headers: {} }, res);

    expect(runtimeReadiness.getCapabilityStatus).toHaveBeenCalledWith("python-runtime");
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      ok: true,
      operation: "runtime.capability-status-read",
      value: capability,
    });
  });

  it("maps invalid capability ids to validation failures without stack traces", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { get: testDouble.fn((path, handler) => handlers.set(path, handler)) };
    const runtimeReadiness = {
      getReadinessSnapshot: testDouble.fn(),
      getCapabilityStatus: testDouble.fn(),
    };

    registerRuntimeReadinessApiRoutes({ app, runtimeReadiness });
    const { res, status, json } = response();
    await handlers.get("/api/runtime/capabilities/:capabilityId")({ params: { capabilityId: "bad-runtime" }, headers: {} }, res);

    expect(runtimeReadiness.getCapabilityStatus).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0]?.[0];
    expect(body).toMatchObject({ ok: false, error: { code: "validation", message: "Unknown runtime capability id." } });
    expect(JSON.stringify(body)).not.toContain("Error:");
  });
});
