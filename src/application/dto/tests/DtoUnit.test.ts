import { describe, expect, it } from "bun:test";
import type { ExecuteWorkflowRequest } from "../ExecuteWorkflowRequest";
import type { InstallModelRequest } from "../InstallModelRequest";

describe("application/dto unit coverage", () => {
  it("supports deeply nested execute request overrides", () => {
    const request: ExecuteWorkflowRequest = {
      workflowId: "wf-1",
      propertyOverrides: {
        "node-1": {
          width: 1024,
          height: 768,
        },
      },
      validateBeforeExecute: true,
      validationOptions: {
        detectUnreachableNodes: true,
        requireConnectedGraph: true,
      },
    };

    expect(request.propertyOverrides?.["node-1"]?.width).toBe(1024);
    expect(request.validationOptions?.requireConnectedGraph).toBeTrue();
  });

  it("supports install request options", () => {
    const request: InstallModelRequest = {
      modelId: "sdxl",
      destination: "models/sdxl",
      overwrite: true,
      verifyIntegrity: true,
      registerInstalled: true,
    };

    expect(request.overwrite).toBeTrue();
    expect(request.verifyIntegrity).toBeTrue();
    expect(request.destination).toBe("models/sdxl");
  });
});
