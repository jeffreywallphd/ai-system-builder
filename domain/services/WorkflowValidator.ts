import type { IWorkflow } from "../workflows/interfaces/IWorkflow";
import type { IWorkflowGraph } from "../workflows/interfaces/IWorkflowGraph";
import type { INode } from "../nodes/interfaces/INode";
import type { IWorkflowConnection } from "../workflows/interfaces/IWorkflowConnection";
import type {
  IWorkflowValidationMessage,
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
  IWorkflowValidator,
} from "./interfaces/IWorkflowValidator";
import { NodeCompatibilityService } from "./NodeCompatibilityService";

function addMessage(
  messages: IWorkflowValidationMessage[],
  message: IWorkflowValidationMessage
): void {
  messages.push(message);
}

function partitionMessages(messages: ReadonlyArray<IWorkflowValidationMessage>): {
  readonly errors: ReadonlyArray<IWorkflowValidationMessage>;
  readonly warnings: ReadonlyArray<IWorkflowValidationMessage>;
  readonly info: ReadonlyArray<IWorkflowValidationMessage>;
} {
  return {
    errors: Object.freeze(messages.filter((message) => message.severity === "error")),
    warnings: Object.freeze(
      messages.filter((message) => message.severity === "warning")
    ),
    info: Object.freeze(messages.filter((message) => message.severity === "info")),
  };
}

export class WorkflowValidationResult implements IWorkflowValidationResult {
  public readonly isValid: boolean;
  public readonly messages: ReadonlyArray<IWorkflowValidationMessage>;
  public readonly errors: ReadonlyArray<IWorkflowValidationMessage>;
  public readonly warnings: ReadonlyArray<IWorkflowValidationMessage>;
  public readonly info: ReadonlyArray<IWorkflowValidationMessage>;
  public readonly invalidNodeIds: ReadonlyArray<string>;
  public readonly invalidConnectionIds: ReadonlyArray<string>;

  constructor(params: {
    messages?: ReadonlyArray<IWorkflowValidationMessage>;
    invalidNodeIds?: ReadonlyArray<string>;
    invalidConnectionIds?: ReadonlyArray<string>;
    treatWarningsAsErrors?: boolean;
  } = {}) {
    this.messages = Object.freeze([...(params.messages ?? [])]);
    const partitions = partitionMessages(this.messages);
    this.errors = partitions.errors;
    this.warnings = partitions.warnings;
    this.info = partitions.info;
    this.invalidNodeIds = Object.freeze([...(params.invalidNodeIds ?? [])]);
    this.invalidConnectionIds = Object.freeze([
      ...(params.invalidConnectionIds ?? []),
    ]);

    this.isValid =
      this.errors.length === 0 &&
      (!params.treatWarningsAsErrors || this.warnings.length === 0);
  }

  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  public hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  public hasMessage(code: IWorkflowValidationMessage["code"]): boolean {
    return this.messages.some((message) => message.code === code);
  }
}

export class WorkflowValidator implements IWorkflowValidator {
  private readonly nodeCompatibilityService: NodeCompatibilityService;

  constructor(nodeCompatibilityService?: NodeCompatibilityService) {
    this.nodeCompatibilityService =
      nodeCompatibilityService ?? new NodeCompatibilityService();
  }

  public validateWorkflow(
    workflow: IWorkflow,
    options: IWorkflowValidationOptions = {}
  ): IWorkflowValidationResult {
    const messages: IWorkflowValidationMessage[] = [];
    const invalidNodeIds = new Set<string>();
    const invalidConnectionIds = new Set<string>();

    if (workflow.nodes.length === 0) {
      addMessage(messages, {
        code: "workflow-empty",
        severity: "error",
        scope: "workflow",
        message: "Workflow must contain at least one node.",
        target: { workflowId: workflow.id },
      });
    }

    if (!workflow.isEnabled) {
      addMessage(messages, {
        code: "workflow-disabled",
        severity: "warning",
        scope: "workflow",
        message: "Workflow is disabled.",
        target: { workflowId: workflow.id },
      });
    }

    const graphResult = this.validateGraph(workflow.toGraph(), options);
    messages.push(...graphResult.messages);
    graphResult.invalidNodeIds.forEach((id) => invalidNodeIds.add(id));
    graphResult.invalidConnectionIds.forEach((id) => invalidConnectionIds.add(id));

    for (const node of workflow.nodes) {
      const nodeResult = this.validateNode(node, {
        workflow,
        graph: workflow.toGraph(),
        options,
      });

      messages.push(...nodeResult.messages);
      nodeResult.invalidNodeIds.forEach((id) => invalidNodeIds.add(id));
    }

    for (const connection of workflow.connections) {
      const connectionResult = this.validateConnection(connection, {
        workflow,
        graph: workflow.toGraph(),
        options,
      });

      messages.push(...connectionResult.messages);
      connectionResult.invalidConnectionIds.forEach((id) =>
        invalidConnectionIds.add(id)
      );
    }

    if (
      options.runtime &&
      workflow.runtimeProfile?.allowedRuntimes &&
      workflow.runtimeProfile.allowedRuntimes.length > 0 &&
      !workflow.runtimeProfile.allowedRuntimes.includes(options.runtime)
    ) {
      addMessage(messages, {
        code: "runtime-not-supported",
        severity: "error",
        scope: "runtime",
        message: `Workflow does not allow runtime '${options.runtime}'.`,
        target: { workflowId: workflow.id },
      });
    }

    if (
      workflow.runtimeProfile?.preferredRuntime &&
      workflow.runtimeProfile.allowedRuntimes &&
      !workflow.runtimeProfile.allowedRuntimes.includes(
        workflow.runtimeProfile.preferredRuntime
      )
    ) {
      addMessage(messages, {
        code: "runtime-preferred-not-allowed",
        severity: "error",
        scope: "runtime",
        message: "Preferred runtime is not included in allowed runtimes.",
        target: { workflowId: workflow.id },
      });
    }

    if (
      workflow.executionPolicy === "acyclic-only" &&
      workflow.toGraph().hasCycles()
    ) {
      addMessage(messages, {
        code: "workflow-policy-violation",
        severity: "error",
        scope: "policy",
        message: "Workflow execution policy does not allow cycles.",
        target: { workflowId: workflow.id },
      });
    }

    return new WorkflowValidationResult({
      messages,
      invalidNodeIds: [...invalidNodeIds],
      invalidConnectionIds: [...invalidConnectionIds],
      treatWarningsAsErrors: options.treatWarningsAsErrors,
    });
  }

  public validateGraph(
    graph: IWorkflowGraph,
    options: IWorkflowValidationOptions = {}
  ): IWorkflowValidationResult {
    const messages: IWorkflowValidationMessage[] = [];
    const invalidNodeIds = new Set<string>();
    const invalidConnectionIds = new Set<string>();

    const graphValidation = graph.validate();

    graphValidation.messages.forEach((message) => {
      addMessage(messages, {
        code: message.includes("Cycle")
          ? "graph-cycle-detected"
          : message.includes("does not exist")
          ? "connection-invalid"
          : message.includes("accepts only one")
          ? "connection-cardinality-violation"
          : "custom",
        severity: "error",
        scope: message.startsWith("[Node")
          ? "node"
          : message.startsWith("[Connection")
          ? "connection"
          : "graph",
        message,
      });
    });

    graphValidation.invalidNodeIds.forEach((id) => invalidNodeIds.add(id));
    graphValidation.invalidConnectionIds.forEach((id) =>
      invalidConnectionIds.add(id)
    );

    if (options.requireConnectedGraph) {
      const entryNodes = graph.getEntryNodes();

      if (entryNodes.length === 0 && graph.nodes.length > 0) {
        addMessage(messages, {
          code: "graph-missing-entry-node",
          severity: "error",
          scope: "graph",
          message: "Graph does not contain an entry node.",
        });
      }

      const visited = new Set<string>();
      const stack = [...entryNodes.map((node) => node.id)];

      while (stack.length > 0) {
        const nodeId = stack.pop()!;

        if (visited.has(nodeId)) {
          continue;
        }

        visited.add(nodeId);

        for (const successor of graph.getSuccessors(nodeId)) {
          if (!visited.has(successor.id)) {
            stack.push(successor.id);
          }
        }
      }

      for (const node of graph.nodes) {
        if (!visited.has(node.id)) {
          invalidNodeIds.add(node.id);
          addMessage(messages, {
            code: "graph-disconnected",
            severity: "error",
            scope: "graph",
            message: `Node '${node.id}' is disconnected from the main graph.`,
            target: { nodeId: node.id },
          });
        }
      }
    }

    if (options.detectUnreachableNodes) {
      const entryNodes = graph.getEntryNodes();

      if (entryNodes.length > 0) {
        const reachable = new Set<string>();
        const stack = [...entryNodes.map((node) => node.id)];

        while (stack.length > 0) {
          const nodeId = stack.pop()!;

          if (reachable.has(nodeId)) {
            continue;
          }

          reachable.add(nodeId);

          for (const successor of graph.getSuccessors(nodeId)) {
            stack.push(successor.id);
          }
        }

        for (const node of graph.nodes) {
          if (!reachable.has(node.id)) {
            invalidNodeIds.add(node.id);
            addMessage(messages, {
              code: "graph-unreachable-node",
              severity: "warning",
              scope: "graph",
              message: `Node '${node.id}' is unreachable from any entry node.`,
              target: { nodeId: node.id },
            });
          }
        }
      }
    }

    if (options.requireEntryNode && graph.nodes.length > 0 && graph.getEntryNodes().length === 0) {
      addMessage(messages, {
        code: "graph-missing-entry-node",
        severity: "error",
        scope: "graph",
        message: "Graph does not contain an entry node.",
      });
    }

    if (options.requireExitNode && graph.nodes.length > 0 && graph.getExitNodes().length === 0) {
      addMessage(messages, {
        code: "graph-missing-exit-node",
        severity: "warning",
        scope: "graph",
        message: "Graph does not contain an exit node.",
      });
    }

    return new WorkflowValidationResult({
      messages,
      invalidNodeIds: [...invalidNodeIds],
      invalidConnectionIds: [...invalidConnectionIds],
      treatWarningsAsErrors: options.treatWarningsAsErrors,
    });
  }

  public validateNode(
    node: INode,
    context?: {
      readonly workflow?: IWorkflow;
      readonly graph?: IWorkflowGraph;
      readonly options?: IWorkflowValidationOptions;
    }
  ): IWorkflowValidationResult {
    const messages: IWorkflowValidationMessage[] = [];
    const invalidNodeIds = new Set<string>();

    const nodeValidation = node.validate();

    if (!nodeValidation.isValid) {
      invalidNodeIds.add(node.id);

      nodeValidation.messages.forEach((message) => {
        addMessage(messages, {
          code: "node-invalid",
          severity: "error",
          scope: "node",
          message,
          target: { nodeId: node.id },
        });
      });
    }

    if (!node.isEnabled && context?.options?.failOnDisabledNodes) {
      invalidNodeIds.add(node.id);
      addMessage(messages, {
        code: "node-disabled",
        severity: "error",
        scope: "node",
        message: `Node '${node.id}' is disabled.`,
        target: { nodeId: node.id },
      });
    }

    if (context?.options?.runtime) {
      if (!node.definition.capabilities.supportsRuntime(context.options.runtime)) {
        invalidNodeIds.add(node.id);
        addMessage(messages, {
          code: "node-runtime-incompatible",
          severity: "error",
          scope: "runtime",
          message: `Node '${node.id}' does not support runtime '${context.options.runtime}'.`,
          target: { nodeId: node.id },
        });
      }

      if (
        node.executionProfile?.runtime &&
        node.executionProfile.runtime !== context.options.runtime
      ) {
        invalidNodeIds.add(node.id);
        addMessage(messages, {
          code: "node-runtime-incompatible",
          severity: "error",
          scope: "runtime",
          message: `Node '${node.id}' is configured for runtime '${node.executionProfile.runtime}', not '${context.options.runtime}'.`,
          target: { nodeId: node.id },
        });
      }
    }

    if (context?.options?.validateModelCompatibility && node.isModelAware()) {
      if (
        node.executionProfile?.modelCompatibility &&
        context.options.runtime &&
        !node.executionProfile.modelCompatibility.supportsRuntime(
          context.options.runtime
        )
      ) {
        invalidNodeIds.add(node.id);
        addMessage(messages, {
          code: "node-model-incompatible",
          severity: "error",
          scope: "model",
          message: `Node '${node.id}' model profile does not support runtime '${context.options.runtime}'.`,
          target: { nodeId: node.id },
        });
      }
    }

    return new WorkflowValidationResult({
      messages,
      invalidNodeIds: [...invalidNodeIds],
      invalidConnectionIds: [],
      treatWarningsAsErrors: context?.options?.treatWarningsAsErrors,
    });
  }

  public validateConnection(
    connection: IWorkflowConnection,
    context?: {
      readonly workflow?: IWorkflow;
      readonly graph?: IWorkflowGraph;
      readonly options?: IWorkflowValidationOptions;
    }
  ): IWorkflowValidationResult {
    const messages: IWorkflowValidationMessage[] = [];
    const invalidConnectionIds = new Set<string>();

    const graph = context?.graph ?? context?.workflow?.toGraph();

    if (!graph) {
      return new WorkflowValidationResult({
        messages,
        invalidNodeIds: [],
        invalidConnectionIds: [],
        treatWarningsAsErrors: context?.options?.treatWarningsAsErrors,
      });
    }

    const sourceNode = graph.getNode(connection.source.nodeId);
    const targetNode = graph.getNode(connection.target.nodeId);

    if (!sourceNode) {
      invalidConnectionIds.add(connection.id);
      addMessage(messages, {
        code: "connection-missing-source-node",
        severity: "error",
        scope: "connection",
        message: `Connection '${connection.id}' references missing source node '${connection.source.nodeId}'.`,
        target: { connectionId: connection.id, nodeId: connection.source.nodeId },
      });
    }

    if (!targetNode) {
      invalidConnectionIds.add(connection.id);
      addMessage(messages, {
        code: "connection-missing-target-node",
        severity: "error",
        scope: "connection",
        message: `Connection '${connection.id}' references missing target node '${connection.target.nodeId}'.`,
        target: { connectionId: connection.id, nodeId: connection.target.nodeId },
      });
    }

    if (!sourceNode || !targetNode) {
      return new WorkflowValidationResult({
        messages,
        invalidNodeIds: [],
        invalidConnectionIds: [...invalidConnectionIds],
        treatWarningsAsErrors: context?.options?.treatWarningsAsErrors,
      });
    }

    const result = this.nodeCompatibilityService.evaluateConnectionCompatibility(
      connection,
      {
        sourceNode,
        targetNode,
        workflow: context?.workflow,
        graph,
        runtime: context?.options?.runtime,
      }
    );

    if (!result.isCompatible) {
      invalidConnectionIds.add(connection.id);
    }

    for (const reason of result.reasons) {
      addMessage(messages, {
        code:
          reason.code === "connection-invalid"
            ? "connection-invalid"
            : reason.code === "port-value-type-mismatch"
            ? "connection-type-incompatible"
            : reason.code === "port-direction-mismatch"
            ? "connection-invalid"
            : "custom",
        severity: reason.severity === "warning" ? "warning" : "error",
        scope: "connection",
        message: reason.message,
        target: {
          connectionId: connection.id,
          nodeId: reason.sourceNodeId ?? reason.targetNodeId,
          portId: reason.sourcePortId ?? reason.targetPortId,
          propertyId: reason.propertyId,
        },
      });
    }

    return new WorkflowValidationResult({
      messages,
      invalidNodeIds: [],
      invalidConnectionIds: [...invalidConnectionIds],
      treatWarningsAsErrors: context?.options?.treatWarningsAsErrors,
    });
  }
}
