import { describe, expect, it } from "bun:test";
import type { IWorkflowRepository } from "../../ports/interfaces/IWorkflowRepository";
import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import { CanonicalWorkflowTemplateContractResolver } from "../CanonicalWorkflowTemplateContractResolver";

class InMemoryWorkflowRepository implements IWorkflowRepository {
  constructor(private readonly workflowById: Readonly<Record<string, IWorkflow>>) {}
  async save(workflow: IWorkflow): Promise<IWorkflow> { return workflow; }
  async load(id: string): Promise<IWorkflow | undefined> { return this.workflowById[id]; }
  async delete(): Promise<void> {}
  async exists(id: string): Promise<boolean> { return !!this.workflowById[id]; }
  async list(): Promise<ReadonlyArray<{ id: string; metadata: IWorkflow["metadata"]; status: IWorkflow["status"]; isEnabled: boolean; }>> { return []; }
}

function createWorkflow(id: string): IWorkflow {
  return {
    id,
    metadata: { name: `wf-${id}` },
    status: "ready",
    isEnabled: true,
    executionPolicy: "acyclic-only",
    nodes: [],
    connections: [],
    getNode: () => undefined,
    getConnection: () => undefined,
    hasNode: () => false,
    hasConnection: () => false,
    addNode: () => { throw new Error("not implemented"); },
    updateNode: () => { throw new Error("not implemented"); },
    removeNode: () => { throw new Error("not implemented"); },
    connect: () => { throw new Error("not implemented"); },
    disconnect: () => { throw new Error("not implemented"); },
    withMetadata: () => { throw new Error("not implemented"); },
    withStatus: () => { throw new Error("not implemented"); },
    withRuntimeProfile: () => { throw new Error("not implemented"); },
    withExecutionPolicy: () => { throw new Error("not implemented"); },
    enable: () => { throw new Error("not implemented"); },
    disable: () => { throw new Error("not implemented"); },
    toGraph: () => ({ nodes: [], edges: [], entryNodeIds: [], terminalNodeIds: [] }),
    validate: () => ({ isValid: true, messages: [], invalidNodeIds: [], invalidConnectionIds: [] }),
  } as unknown as IWorkflow;
}

describe("CanonicalWorkflowTemplateContractResolver", () => {
  it("resolves workflow contracts from canonical workflow asset identifiers", async () => {
    const repository = new InMemoryWorkflowRepository({ base: createWorkflow("base") });
    const resolver = new CanonicalWorkflowTemplateContractResolver(repository);

    const contract = await resolver.resolveWorkflowContract({ workflowAssetId: "workflow-definition:base" });
    expect(contract?.parameters.some((entry) => entry.id === "executionPolicy")).toBeTrue();
  });
});
