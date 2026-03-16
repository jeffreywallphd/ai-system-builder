import { describe, expect, it } from "bun:test";

import { WorkflowPresenter } from "../WorkflowPresenter";

describe("ui/presenters interactions", () => {
  it("WorkflowPresenter composes ValidationPresenter and NodePresenter", () => {
    const presenter = new WorkflowPresenter();
    const workflow = {
      id: "wf",
      metadata: { name: "Workflow", description: "", author: "a", tags: [], version: "1" },
      status: "draft",
      isEnabled: true,
      executionPolicy: {},
      runtimeProfile: undefined,
      audit: undefined,
      nodes: [
        {
          id: "n1",
          definition: { id: "d1", type: "t", title: "Node", category: "c", executionKind: "sync" },
          title: "",
          notes: undefined,
          position: undefined,
          size: undefined,
          properties: [],
          inputPorts: [],
          outputPorts: [],
          executionProfile: undefined,
          isEnabled: true,
          isCollapsed: false,
          isExecutable: () => true,
          isModelAware: () => false,
        },
      ],
      connections: [],
      getNode: () => ({
        id: "n1",
        definition: { title: "Node", type: "t", category: "c", executionKind: "sync" },
        title: "",
        notes: undefined,
        position: undefined,
        size: undefined,
        properties: [],
        inputPorts: [],
        outputPorts: [],
        isEnabled: true,
        isCollapsed: false,
        isExecutable: () => true,
        isModelAware: () => false,
      }),
      toGraph: () => ({ getEntryNodes: () => [], getExitNodes: () => [], hasCycles: () => false }),
      isExecutable: () => true,
      validate: () => ({ isValid: true, messages: [], errors: [], warnings: [], info: [] }),
    };

    const view = presenter.present(workflow as never, {
      selectedNodeId: "n1",
      validation: { isValid: true, messages: [], errors: [], warnings: [], info: [] } as never,
    });

    expect(view.selectedNode?.id).toBe("n1");
    expect(view.validation.isValid).toBeTrue();
    expect(view.header.status).toBe("Draft");
  });
});
