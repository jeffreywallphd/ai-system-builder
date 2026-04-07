import { describe, expect, it } from "bun:test";
import { CreateNodeUseCase } from "../CreateNodeUseCase";
import { UpdateNodePropertyUseCase } from "../UpdateNodePropertyUseCase";
import { ConnectNodesUseCase } from "../ConnectNodesUseCase";
import { RemoveNodeUseCase } from "../RemoveNodeUseCase";
import { makeNode, makeNodePort, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodePort } from "../../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { makeNodeCatalogProvider, makeNodeCompatibilityService } from "./testUtils";

describe("application/nodes interactions", () => {
  it("create -> update -> connect -> remove flow", async () => {
    const baseWorkflow = makeWorkflow({ nodes: [makeNode({ id: "existing", outputPorts: [makeNodePort({ id: "out", direction: "output" })] })] });

    const def = new NodeDefinition({
      id: "def",
      type: "consumer",
      title: "Consumer",
      category: "utility",
      inputPorts: [new NodePort({ id: "in", name: "in", direction: "input" })],
      outputPorts: [new NodePort({ id: "out", name: "out", direction: "output" })],
      properties: [new NodeProperty({ id: "text", name: "Text", type: "text", value: "x" })],
    });

    const created = await new CreateNodeUseCase(makeNodeCatalogProvider({ getDefinitionByType: async () => def }), () => "new-node")
      .execute({ workflow: baseWorkflow, definitionType: "consumer" });
    const updated = new UpdateNodePropertyUseCase().execute({ workflow: created.workflow, nodeId: "new-node", propertyId: "text", value: "ok" });
    const connected = new ConnectNodesUseCase(makeNodeCompatibilityService(), () => "conn")
      .execute({ workflow: updated.workflow, sourceNodeId: "existing", sourcePortId: "out", targetNodeId: "new-node", targetPortId: "in" });
    const removed = new RemoveNodeUseCase().execute({ workflow: connected.workflow, nodeId: "new-node" });

    expect(updated.property.value).toBe("ok");
    expect(connected.connection.id).toBe("conn");
    expect(removed.removedConnectionIds).toEqual(["conn"]);
  });
});
