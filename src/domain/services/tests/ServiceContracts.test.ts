import { describe, expect, it } from "bun:test";
import { ModelCompatibilityService } from "../ModelCompatibilityService";
import { NodeCompatibilityService } from "../NodeCompatibilityService";
import { WorkflowValidator } from "../WorkflowValidator";
import type { IModelCompatibilityService } from "../interfaces/IModelCompatibilityService";
import type { INodeCompatibilityService } from "../interfaces/INodeCompatibilityService";
import type { IWorkflowValidator } from "../interfaces/IWorkflowValidator";
import { makeCompatibility, makeConnection, makeModel, makeNode, makeWorkflow } from "./testUtils";

describe("Service interface contracts", () => {
  it("concrete services satisfy domain interface contracts", () => {
    const modelService: IModelCompatibilityService = new ModelCompatibilityService();
    const nodeService: INodeCompatibilityService = new NodeCompatibilityService();
    const workflowValidator: IWorkflowValidator = new WorkflowValidator();

    const modelA = makeModel("a");
    const modelB = makeModel("b");
    expect(modelService.evaluateModelToModelCompatibility(modelA, modelB).isCompatible).toBeTrue();

    const nodeA = makeNode({ id: "a" });
    const nodeB = makeNode({ id: "b" });
    const connection = makeConnection("ab", "a", "b");
    expect(
      nodeService.evaluateConnectionCompatibility(connection, {
        sourceNode: nodeA,
        targetNode: nodeB,
        runtime: "vllm",
      }).isCompatible
    ).toBeTrue();

    const workflow = makeWorkflow({ nodes: [nodeA, nodeB], connections: [connection] });
    const validation = workflowValidator.validateWorkflow(workflow, {
      runtime: "vllm",
      validateModelCompatibility: true,
    });
    expect(validation.messages.length).toBe(0);

    const profileResult = nodeService.evaluateNodeModelCompatibility(nodeA, makeCompatibility());
    expect(profileResult.isCompatible).toBeTrue();
  });
});
