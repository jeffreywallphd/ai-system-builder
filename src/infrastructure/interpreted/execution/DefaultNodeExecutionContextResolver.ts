import type {
  INodeExecutionContext,
  INodeExecutionContextResolveInput,
  INodeExecutionContextResolver,
} from "@application/ports/interfaces/INodeExecutionContextResolver";

export class DefaultNodeExecutionContextResolver
  implements INodeExecutionContextResolver
{
  public resolve(input: INodeExecutionContextResolveInput): INodeExecutionContext {
    const graph = input.workflow.toGraph();
    const inboundConnections = graph.getInboundConnections(input.node.id);

    const upstreamOutputs: Record<string, Readonly<Record<string, unknown>>> = {};
    const resolvedInputs: Record<string, unknown> = {};

    for (const connection of inboundConnections) {
      if (!connection.isActive()) {
        continue;
      }

      const sourceOutput = input.outputStore.getNodeOutput(connection.source.nodeId);
      if (!sourceOutput) {
        continue;
      }

      upstreamOutputs[connection.source.nodeId] = sourceOutput;
      resolvedInputs[connection.target.portId] = sourceOutput[connection.source.portId];
    }

    return Object.freeze({
      workflow: input.workflow,
      node: input.node,
      inputAssets: Object.freeze([...(input.inputAssets ?? [])]),
      workflowInputs: Object.freeze({ ...(input.workflowInputs ?? {}) }),
      upstreamOutputs: Object.freeze(upstreamOutputs),
      resolvedInputs: Object.freeze(resolvedInputs),
      executionMetadata: input.executionMetadata,
    });
  }
}

