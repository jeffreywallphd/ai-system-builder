import { describe, expect, it } from "bun:test";
import { DeploymentEndpointRuntimeInvoker } from "../DeploymentEndpointRuntimeInvoker";

describe("DeploymentEndpointRuntimeInvoker", () => {
  it("forwards routed endpoint invocation into external runtime start-execution contract", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const externalRuntime = {
      startExecution: async (request: Record<string, unknown>) => {
        calls.push(request);
        return Object.freeze({ ok: true, data: Object.freeze({ executionId: "ext-exec:1" }) });
      },
    };

    const invoker = new DeploymentEndpointRuntimeInvoker(externalRuntime as never);
    const response = await invoker.invoke({
      systemId: "system:root",
      versionId: "system:root:v8",
      executionId: "ext-exec:routed",
      inputPayload: Object.freeze({ hello: "world" }),
      tenantId: "tenant:alpha",
      requestSource: "external-api",
    });

    expect(response.ok).toBeTrue();
    expect(calls.length).toBe(1);
    expect(calls[0]?.systemId).toBe("system:root");
    expect(calls[0]?.versionId).toBe("system:root:v8");
    expect(calls[0]?.executionId).toBe("ext-exec:routed");
    expect(calls[0]?.tenantId).toBe("tenant:alpha");
  });
});
