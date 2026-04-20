import { describe, expect, it } from "../../../../testing/node-test";

import {
  mapCapabilitiesResponseFromHttpPayload,
  mapHealthResponseFromHttpPayload,
  mapTaskRequestToHttpPayload,
  mapTaskResponseFromHttpPayload,
} from "../protocol/pythonRuntimeHttpProtocol";

describe("pythonRuntimeHttpProtocol", () => {
  it("keeps contract payloads canonical when mapping to/from HTTP payloads", () => {
    const request = {
      requestId: "req-python-1",
      taskType: "prepare-templated-dataset",
      payload: { template: "{{text}}" },
    };

    const requestPayload = mapTaskRequestToHttpPayload(request);
    expect(requestPayload).toEqual(request);

    const health = mapHealthResponseFromHttpPayload({
      healthy: true,
      status: {
        runtimeId: "python-sidecar",
        status: "ready",
      },
    });
    expect(health.status.runtimeId).toBe("python-sidecar");

    const capabilities = mapCapabilitiesResponseFromHttpPayload({
      runtimeId: "python-sidecar",
      capabilities: ["prepare-templated-dataset"],
    });
    expect(capabilities.capabilities).toContain("prepare-templated-dataset");

    const taskResult = mapTaskResponseFromHttpPayload({
      requestId: "req-python-1",
      taskType: "prepare-templated-dataset",
      success: false,
      error: {
        code: "not_implemented",
        message: "Not implemented.",
      },
    });
    expect(taskResult.success).toBe(false);
  });
});
