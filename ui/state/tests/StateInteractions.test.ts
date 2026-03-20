import { describe, expect, it } from "bun:test";
import { McpToolCallNodeConfigurationService } from "../../../application/mcp/McpToolCallNodeConfigurationService";
import { ImplementationRegistryNodeCatalogProvider } from "../../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { McpNodeImplementationRegistry } from "../../../infrastructure/nodes/mcp/McpNodeImplementationRegistry";
import { Workflow } from "../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { WorkflowExecutionStore } from "../WorkflowExecutionStore";
import { WorkflowStore } from "../WorkflowStore";

describe("ui/state interactions", () => {
  it("createWorkflow updates current workflow and dirty flag", async () => {
    const created = { id: "w1" } as any;
    const store = new WorkflowStore({
      workflowService: {
        createWorkflow: async () => ({ workflow: created }),
      } as any,
      nodeService: {} as any,
    });

    await store.createWorkflow({ name: "Test" } as any);

    expect(store.getState().currentWorkflow).toBe(created);
    expect(store.getState().isDirty).toBeTrue();
    expect(store.getState().isLoading).toBeFalse();
  });

  it("does not overwrite dirty in-memory workflow when a stale load resolves", async () => {
    let resolveLoad: ((value: any) => void) | undefined;
    const localWorkflow = { id: "w1", nodes: [{ id: "n-local" }] } as any;
    const remoteWorkflow = { id: "w1", nodes: [] } as any;

    const store = new WorkflowStore({
      workflowService: {
        loadWorkflow: async () =>
          await new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      } as any,
      nodeService: {} as any,
      initialState: {
        currentWorkflow: localWorkflow,
        isDirty: true,
      },
    });

    const pending = store.loadWorkflow("w1");
    resolveLoad?.(remoteWorkflow);
    await pending;

    expect(store.getState().currentWorkflow).toBe(localWorkflow);
    expect(store.getState().isDirty).toBeTrue();
  });

  it("captures workflow output assets from execution events and results", async () => {
    const workflow = { id: "wf-1" } as any;
    const outputAsset = { id: "asset-1", name: "Result", kind: "image" } as any;
    const store = new WorkflowStore({
      workflowService: {
        executeWorkflow: async (_request: any, onEvent?: (event: any) => void) => {
          onEvent?.({
            executionId: "exec-1",
            kind: "asset-produced",
            status: "running",
            asset: outputAsset,
          });

          return {
            effectiveWorkflow: workflow,
            result: {
              executionId: "exec-1",
              status: "completed",
              outputAssets: [outputAsset],
            },
          };
        },
      } as any,
      nodeService: {} as any,
      initialState: {
        currentWorkflow: workflow,
      },
    });

    await store.executeCurrentWorkflow();

    expect(store.getState().outputAssets).toEqual([outputAsset]);
    expect(store.getState().isExecuting).toBeFalse();
  });

  it("resets execution state when switching workflows without disturbing editor state shape", async () => {
    const nextWorkflow = { id: "wf-2" } as any;
    const executionStore = new WorkflowExecutionStore({
      initialState: {
        isExecuting: false,
        lastExecutionEvent: { executionId: "exec-1" } as any,
        nodeExecutionOutputs: { "n-1": { value: 1 } },
        outputAssets: [{ id: "asset-1" } as any],
      },
    });
    const store = new WorkflowStore({
      workflowService: {
        loadWorkflow: async () => nextWorkflow,
      } as any,
      nodeService: {} as any,
      executionStore,
      initialState: {
        currentWorkflow: { id: "wf-1" } as any,
        validation: { isValid: true } as any,
        selectedNodeId: "n-1",
      },
    });

    await store.loadWorkflow("wf-2");

    expect(store.getState().currentWorkflow).toBe(nextWorkflow);
    expect(store.getState().validation).toBeUndefined();
    expect(store.getState().selectedNodeId).toBeUndefined();
    expect(store.getState().lastExecutionEvent).toBeUndefined();
    expect(store.getState().nodeExecutionOutputs).toEqual({});
    expect(store.getState().outputAssets).toEqual([]);
  });

  it("routes MCP tool call property updates through authoring configuration so generated fields appear in editor state", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(new McpNodeImplementationRegistry());
    const definition = await provider.getDefinitionByType("mcp.tool_call");
    if (!definition) {
      throw new Error("Expected mcp.tool_call definition.");
    }

    const node = definition.createInstance("call-1");
    const workflow = new Workflow({
      id: "wf-mcp",
      metadata: new WorkflowMetadata({ name: "Workflow" }),
      nodes: [node],
    });
    const configurationService = new McpToolCallNodeConfigurationService();

    const store = new WorkflowStore({
      workflowService: {
        updateNodeProperty: (currentWorkflow: Workflow, nodeId: string, propertyId: string, value: unknown) =>
          currentWorkflow.updateNode(currentWorkflow.getNode(nodeId)!.withPropertyValue(propertyId, value)),
      } as any,
      nodeService: {} as any,
      mcpToolCallAuthoringService: {
        applyPropertyChange: async (currentWorkflow: Workflow, nodeId: string, propertyId: string, value: unknown) => {
          let updatedNode = currentWorkflow.getNode(nodeId)!.withPropertyValue(propertyId, value);
          updatedNode = configurationService.configureNode(updatedNode, {
            serverOptions: [{ label: "Local MCP", value: "local" }],
            toolOptions: [{ label: "Echo", value: "echo" }],
            toolDescriptor: {
              id: "mcp:local:echo",
              serverId: "local",
              source: { kind: "mcp-server", serverId: "local" },
              name: "echo",
              inputSchema: { type: "object" },
              arguments: [{ name: "message", type: "string", required: true, schema: { type: "string" } }],
              categories: [],
              tags: [],
            },
          });
          return currentWorkflow.updateNode(updatedNode);
        },
      } as any,
      initialState: {
        currentWorkflow: workflow,
      },
    });

    await store.updateNodeProperty("call-1", "toolName", "echo");

    expect(store.getState().currentWorkflow?.getNode("call-1")?.getProperty("toolName")?.value).toBe("echo");
    expect(store.getState().currentWorkflow?.getNode("call-1")?.getProperty("arg.message")?.name).toBe("message");
  });

  it("applies projected workflow form input for context recipe and package bindings", async () => {
    const workflow = new Workflow({
      id: "wf-context",
      metadata: new WorkflowMetadata({
        name: "Workflow",
        contextConfiguration: {
          recipeSelections: [{ recipeId: "company-default", alias: "Company default", surfaceInTool: true }],
          selectedRecipeIds: ["company-default"],
          packageReferences: [{ packageId: "pkg-style", alias: "Style guide" }],
          selectedPackageIds: ["pkg-style"],
          visibilityMode: "advanced",
        },
      }),
    });
    const store = new WorkflowStore({
      workflowService: {} as any,
      nodeService: {} as any,
      initialState: {
        currentWorkflow: workflow,
      },
    });

    store.applyFormInput({
      "workflow.context.recipeSelections": [
        { recipeId: "exec", alias: "Executive", isEnabled: true, surfaceInTool: true },
        { recipeId: "hidden", alias: "Hidden", isEnabled: false, surfaceInTool: false },
      ],
      "workflow.context.selectedRecipeIds": ["exec", "hidden"],
      "workflow.context.packageReferences": [
        { packageId: "pkg-policy", alias: "Policy", isEnabled: true },
        { packageId: "pkg-style", alias: "Style guide", isEnabled: false },
      ],
      "workflow.context.selectedPackageIds": ["pkg-style", "pkg-policy"],
    });

    expect(store.getState().currentWorkflow?.metadata.contextConfiguration?.recipeSelections).toEqual([
      { recipeId: "exec", alias: "Executive", isEnabled: true, surfaceInTool: true },
      { recipeId: "hidden", alias: "Hidden", isEnabled: false, surfaceInTool: false },
    ]);
    expect(store.getState().currentWorkflow?.metadata.contextConfiguration?.selectedRecipeIds).toEqual(["exec"]);
    expect(store.getState().currentWorkflow?.metadata.contextConfiguration?.packageReferences).toEqual([
      { packageId: "pkg-policy", alias: "Policy", version: undefined, includeFragmentIds: undefined, excludeFragmentIds: undefined, isEnabled: true },
      { packageId: "pkg-style", alias: "Style guide", version: undefined, includeFragmentIds: undefined, excludeFragmentIds: undefined, isEnabled: false },
    ]);
    expect(store.getState().currentWorkflow?.metadata.contextConfiguration?.selectedPackageIds).toEqual(["pkg-policy"]);
    expect(store.getState().isDirty).toBeTrue();
  });

});
