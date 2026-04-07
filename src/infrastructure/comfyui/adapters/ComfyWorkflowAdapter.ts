import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { ComfyNodeDto } from "../dto/ComfyNodeDto";
import type { ComfyWorkflowDto } from "../dto/ComfyWorkflowDto";
import { ComfyNodeAdapter } from "./ComfyNodeAdapter";

export type ComfyPromptWorkflow = Readonly<Record<string, ComfyNodeDto>>;

type MutableComfyPromptNode = {
  class_type: string;
  inputs: Record<string, unknown>;
};

export class ComfyWorkflowAdapter {
  private readonly nodeAdapter: ComfyNodeAdapter;

  constructor(nodeAdapter?: ComfyNodeAdapter) {
    this.nodeAdapter = nodeAdapter ?? new ComfyNodeAdapter();
  }

  public adaptWorkflow(workflow: IWorkflow): ComfyPromptWorkflow {
    const validation = workflow.validate();

    if (!validation.isValid) {
      throw new Error(
        `Workflow '${workflow.id}' is invalid and cannot be adapted to ComfyUI: ` +
          validation.messages.join(" | ")
      );
    }

    const prompt: Record<string, MutableComfyPromptNode> = {};

    for (const node of workflow.nodes) {
      if (!node.isEnabled) {
        continue;
      }

      const adaptedNode = this.nodeAdapter.adaptNode(node);
      prompt[node.id] = {
        class_type: adaptedNode.class_type,
        inputs: { ...adaptedNode.inputs },
      };
    }

    for (const connection of workflow.connections) {
      if (!connection.isActive()) {
        continue;
      }

      const sourceNode = workflow.getNode(connection.source.nodeId);
      const targetNode = workflow.getNode(connection.target.nodeId);

      if (!sourceNode || !targetNode) {
        throw new Error(
          `Connection '${connection.id}' references a missing source or target node.`
        );
      }

      if (!sourceNode.isEnabled || !targetNode.isEnabled) {
        continue;
      }

      const outputIndex = this.nodeAdapter.getOutputPortIndex(
        sourceNode,
        connection.source.portId
      );
      const inputName = this.nodeAdapter.getInputName(targetNode, connection.target.portId);

      const targetPromptNode = prompt[targetNode.id];

      if (!targetPromptNode) {
        throw new Error(
          `Target node '${targetNode.id}' was not adapted into the ComfyUI prompt.`
        );
      }

      targetPromptNode.inputs[inputName] = [String(sourceNode.id), outputIndex];
    }

    const frozenPrompt = Object.fromEntries(
      Object.entries(prompt).map(([nodeId, node]) => [
        nodeId,
        Object.freeze({
          class_type: node.class_type,
          inputs: Object.freeze({ ...node.inputs }),
        }),
      ])
    );

    return Object.freeze(frozenPrompt);
  }

  public adaptWorkflowEnvelope(workflow: IWorkflow): ComfyWorkflowDto {
    return Object.freeze({
      prompt: this.adaptWorkflow(workflow),
      client_id: workflow.id,
    });
  }
}

