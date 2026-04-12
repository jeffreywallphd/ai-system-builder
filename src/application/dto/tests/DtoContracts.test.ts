import { describe, expect, it } from "bun:test";
import type { AssetResponse } from "../AssetResponse";
import type { CreateWorkflowRequest } from "../CreateWorkflowRequest";
import type { ExecuteWorkflowRequest } from "../ExecuteWorkflowRequest";
import type { InstallModelRequest } from "../InstallModelRequest";
import type { ModelResponse } from "../ModelResponse";
import type { SaveWorkflowRequest } from "../SaveWorkflowRequest";
import type { WorkflowResponse } from "../WorkflowResponse";

describe("application/dto contracts", () => {
  it("enforces required roots across dto interfaces", () => {
    const createRequest: CreateWorkflowRequest = { metadata: { name: "wf" } };
    const saveRequest: SaveWorkflowRequest = {
      id: "wf-1",
      metadata: { name: "wf" },
      nodes: [],
      connections: [],
    };
    const executeRequest: ExecuteWorkflowRequest = {};
    const installRequest: InstallModelRequest = { destination: "models/base" };

    const workflowResponse: WorkflowResponse = {
      id: "wf-1",
      metadata: { name: "wf" },
      status: "draft",
      isEnabled: true,
      executionPolicy: "manual",
      nodes: [],
      connections: [],
      graph: { entryNodeIds: [], exitNodeIds: [], hasCycles: false },
      validation: { isValid: true, messages: [], invalidNodeIds: [], invalidConnectionIds: [] },
      isExecutable: false,
    };

    const modelResponse: ModelResponse = {
      id: "m-1",
      name: "Model",
      kind: "checkpoint",
      isRunnable: true,
      status: "available",
      source: { type: "remote" },
      artifact: { name: "weights", accessMethod: "file", format: "safetensors" },
      additionalArtifacts: [],
      dependencies: [],
      requirements: [],
      runtimeCompatibility: {
        runtimes: [],
        providers: [],
      },
      tags: [],
      languageCodes: [],
      requiresAuth: false,
      isAvailable: true,
      isSupportingAsset: false,
      satisfiesRequirements: true,
      reference: "model:m-1",
    };

    const assetResponse: AssetResponse = {
      id: "a-1",
      name: "asset",
      kind: "image",
      status: "available",
      source: { type: "workflow" },
      location: { accessMethod: "file" },
      relationships: [],
      isAvailable: true,
      isGenerated: false,
      isDerived: false,
      reference: "asset:a-1",
    };

    expect(createRequest.metadata.name).toBe("wf");
    expect(saveRequest.nodes).toEqual([]);
    expect(executeRequest).toEqual({});
    expect(installRequest.destination).toBe("models/base");
    expect(workflowResponse.id).toBe("wf-1");
    expect(modelResponse.reference).toBe("model:m-1");
    expect(assetResponse.reference).toBe("asset:a-1");
  });
});
