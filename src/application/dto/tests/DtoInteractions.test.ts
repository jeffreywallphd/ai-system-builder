import { describe, expect, it } from "bun:test";
import type { CreateWorkflowRequest } from "../CreateWorkflowRequest";
import type { SaveWorkflowRequest } from "../SaveWorkflowRequest";
import type { WorkflowResponse } from "../WorkflowResponse";

describe("application/dto interactions", () => {
  it("maps create/save request identities to workflow response shape", () => {
    const createRequest: CreateWorkflowRequest = { id: "wf-9", metadata: { name: "Generator" } };

    const saveRequest: SaveWorkflowRequest = {
      id: createRequest.id ?? "wf-generated",
      metadata: createRequest.metadata,
      nodes: [{ id: "n-1", definitionId: "prompt", properties: [] }],
      connections: [],
    };

    const response: WorkflowResponse = {
      id: saveRequest.id,
      metadata: saveRequest.metadata,
      status: "draft",
      isEnabled: true,
      executionPolicy: "manual",
      nodes: [
        {
          id: "n-1",
          definitionId: "prompt",
          definitionType: "text",
          definitionTitle: "Prompt",
          category: "input",
          executionKind: "sync",
          properties: [],
          inputPorts: [],
          outputPorts: [],
          isEnabled: true,
          isCollapsed: false,
          isExecutable: true,
          isModelAware: false,
        },
      ],
      connections: [],
      graph: { entryNodeIds: ["n-1"], exitNodeIds: ["n-1"], hasCycles: false },
      validation: { isValid: true, messages: [], invalidNodeIds: [], invalidConnectionIds: [] },
      isExecutable: true,
    };

    expect(response.id).toBe(createRequest.id);
    expect(response.metadata.name).toBe(saveRequest.metadata.name);
    expect(response.nodes[0]?.id).toBe(saveRequest.nodes[0]?.id);
  });
});
