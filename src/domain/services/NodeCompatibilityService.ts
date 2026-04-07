import type { INode } from "@domain/nodes/interfaces/INode";
import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type { INodePort } from "@domain/nodes/interfaces/INodePort";
import type { INodeProperty } from "@domain/nodes/interfaces/INodeProperty";
import type { IWorkflowConnection } from "../workflows/interfaces/IWorkflowConnection";
import type { IWorkflow } from "../workflows/interfaces/IWorkflow";
import type { IWorkflowGraph } from "../workflows/interfaces/IWorkflowGraph";
import type { IModel } from "../models/interfaces/IModel";
import type { IModelCompatibility, RuntimeEngine } from "../models/interfaces/IModelCompatibility";
import type {
  INodeCompatibilityContext,
  INodeCompatibilityReason,
  INodeCompatibilityResult,
  INodeCompatibilityService,
} from "./interfaces/INodeCompatibilityService";
import { ModelCompatibilityService } from "./ModelCompatibilityService";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function hasIntersection(
  left?: ReadonlyArray<string>,
  right?: ReadonlyArray<string>
): boolean {
  const normalizedLeft = normalizeArray(left);
  const normalizedRight = new Set(normalizeArray(right));

  if (normalizedLeft.length === 0 || normalizedRight.size === 0) {
    return false;
  }

  return normalizedLeft.some((value) => normalizedRight.has(value));
}

function addReason(
  reasons: INodeCompatibilityReason[],
  reason: INodeCompatibilityReason
): void {
  reasons.push(reason);
}

function determineSeverity(
  reasons: ReadonlyArray<INodeCompatibilityReason>
): INodeCompatibilityResult["severity"] {
  if (reasons.some((reason) => reason.severity === "incompatible")) {
    return "incompatible";
  }

  if (reasons.some((reason) => reason.severity === "warning")) {
    return "warning";
  }

  return "compatible";
}

export class NodeCompatibilityResult implements INodeCompatibilityResult {
  public readonly severity: INodeCompatibilityResult["severity"];
  public readonly isCompatible: boolean;
  public readonly reasons: ReadonlyArray<INodeCompatibilityReason>;

  constructor(reasons: ReadonlyArray<INodeCompatibilityReason> = []) {
    this.reasons = Object.freeze([...reasons]);
    this.severity = determineSeverity(this.reasons);
    this.isCompatible = this.severity !== "incompatible";
  }

  public hasWarnings(): boolean {
    return this.reasons.some((reason) => reason.severity === "warning");
  }

  public hasIncompatibilities(): boolean {
    return this.reasons.some((reason) => reason.severity === "incompatible");
  }
}

export class NodeCompatibilityService implements INodeCompatibilityService {
  private readonly modelCompatibilityService: ModelCompatibilityService;

  constructor(modelCompatibilityService?: ModelCompatibilityService) {
    this.modelCompatibilityService =
      modelCompatibilityService ?? new ModelCompatibilityService();
  }

  public evaluatePortCompatibility(
    sourcePort: INodePort,
    targetPort: INodePort,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult {
    const reasons: INodeCompatibilityReason[] = [];

    if (sourcePort.direction !== "output" || targetPort.direction !== "input") {
      addReason(reasons, {
        code: "port-direction-mismatch",
        severity: "incompatible",
        message: "Ports must connect from an output port to an input port.",
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
      });
    }

    if (sourcePort.isControlPort !== targetPort.isControlPort) {
      addReason(reasons, {
        code: "port-direction-mismatch",
        severity: "incompatible",
        message: "Control ports cannot connect to data ports.",
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
      });
    }

    if (
      !sourcePort.compatibility.isCompatibleWith(targetPort.compatibility) ||
      !targetPort.compatibility.isCompatibleWith(sourcePort.compatibility)
    ) {
      if (
        !sourcePort.compatibility.allowsAnyValueType &&
        !targetPort.compatibility.allowsAnyValueType &&
        !hasIntersection(
          sourcePort.compatibility.valueTypes,
          targetPort.compatibility.valueTypes
        )
      ) {
        addReason(reasons, {
          code: "port-value-type-mismatch",
          severity: "incompatible",
          message: "The two ports do not share a compatible value type.",
          sourcePortId: sourcePort.id,
          targetPortId: targetPort.id,
        });
      }

      if (
        sourcePort.compatibility.modalities &&
        targetPort.compatibility.modalities &&
        !hasIntersection(
          sourcePort.compatibility.modalities,
          targetPort.compatibility.modalities
        )
      ) {
        addReason(reasons, {
          code: "port-modality-mismatch",
          severity: "incompatible",
          message: "The two ports do not share a compatible modality.",
          sourcePortId: sourcePort.id,
          targetPortId: targetPort.id,
        });
      }

      if (
        sourcePort.compatibility.tasks &&
        targetPort.compatibility.tasks &&
        !hasIntersection(
          sourcePort.compatibility.tasks,
          targetPort.compatibility.tasks
        )
      ) {
        addReason(reasons, {
          code: "port-task-mismatch",
          severity: "warning",
          message: "The two ports do not share an overlapping task profile.",
          sourcePortId: sourcePort.id,
          targetPortId: targetPort.id,
        });
      }

      if (
        sourcePort.compatibility.runtimes &&
        targetPort.compatibility.runtimes &&
        !hasIntersection(
          sourcePort.compatibility.runtimes,
          targetPort.compatibility.runtimes
        )
      ) {
        addReason(reasons, {
          code: "port-runtime-mismatch",
          severity: "incompatible",
          message: "The two ports do not share a compatible runtime.",
          sourcePortId: sourcePort.id,
          targetPortId: targetPort.id,
        });
      }

      if (
        sourcePort.compatibility.modelCompatibility &&
        targetPort.compatibility.modelCompatibility
      ) {
        const modelResult =
          this.modelCompatibilityService.evaluateProfileToProfileCompatibility(
            sourcePort.compatibility.modelCompatibility,
            targetPort.compatibility.modelCompatibility,
            {
              runtime: context?.runtime,
              task: context?.task,
              inputModality: context?.modality,
            }
          );

        if (!modelResult.isCompatible) {
          addReason(reasons, {
            code: "port-model-compatibility-mismatch",
            severity: "incompatible",
            message: "The two ports are not model-compatible.",
            sourcePortId: sourcePort.id,
            targetPortId: targetPort.id,
          });
        }
      }

      if (
        sourcePort.compatibility.dependencyConstraints &&
        targetPort.compatibility.dependencyConstraints &&
        sourcePort.compatibility.dependencyConstraints.length > 0 &&
        targetPort.compatibility.dependencyConstraints.length > 0
      ) {
        const dependencyCompatible =
          sourcePort.compatibility.dependencyConstraints.some((sourceDependency) =>
            targetPort.compatibility.dependencyConstraints!.some(
              (targetDependency) =>
                sourceDependency.matches(targetDependency) ||
                targetDependency.matches(sourceDependency)
            )
          );

        if (!dependencyCompatible) {
          addReason(reasons, {
            code: "port-dependency-mismatch",
            severity: "warning",
            message: "The two ports declare incompatible dependency expectations.",
            sourcePortId: sourcePort.id,
            targetPortId: targetPort.id,
          });
        }
      }
    }

    if (
      context?.runtime &&
      (!sourcePort.compatibility.supportsRuntime(context.runtime) ||
        !targetPort.compatibility.supportsRuntime(context.runtime))
    ) {
      addReason(reasons, {
        code: "port-runtime-mismatch",
        severity: "incompatible",
        message: `One or both ports do not support runtime '${context.runtime}'.`,
        sourcePortId: sourcePort.id,
        targetPortId: targetPort.id,
      });
    }

    return new NodeCompatibilityResult(reasons);
  }

  public evaluateConnectionCompatibility(
    connection: IWorkflowConnection,
    context: {
      readonly sourceNode: INode;
      readonly targetNode: INode;
      readonly workflow?: IWorkflow;
      readonly graph?: IWorkflowGraph;
      readonly runtime?: RuntimeEngine;
    }
  ): INodeCompatibilityResult {
    const reasons: INodeCompatibilityReason[] = [];

    const sourcePort = context.sourceNode.getOutputPort(connection.source.portId);
    const targetPort = context.targetNode.getInputPort(connection.target.portId);

    if (!sourcePort || !targetPort) {
      addReason(reasons, {
        code: "connection-invalid",
        severity: "incompatible",
        message: "The connection references a missing source or target port.",
        sourceNodeId: context.sourceNode.id,
        targetNodeId: context.targetNode.id,
        sourcePortId: connection.source.portId,
        targetPortId: connection.target.portId,
      });

      return new NodeCompatibilityResult(reasons);
    }

    reasons.push(
      ...this.evaluatePortCompatibility(sourcePort, targetPort, {
        workflow: context.workflow,
        graph: context.graph,
        runtime: context.runtime,
      }).reasons
    );

    if (context.runtime) {
      reasons.push(
        ...this.evaluateNodeToNodeCompatibility(
          context.sourceNode,
          context.targetNode,
          {
            workflow: context.workflow,
            graph: context.graph,
            runtime: context.runtime,
          }
        ).reasons
      );
    }

    return new NodeCompatibilityResult(reasons);
  }

  public evaluateNodeToNodeCompatibility(
    sourceNode: INode,
    targetNode: INode,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult {
    const reasons: INodeCompatibilityReason[] = [];

    const candidateResults: INodeCompatibilityReason[] = [];

    for (const sourcePort of sourceNode.outputPorts) {
      for (const targetPort of targetNode.inputPorts) {
        const result = this.evaluatePortCompatibility(sourcePort, targetPort, context);

        if (result.isCompatible) {
          candidateResults.length = 0;
          return new NodeCompatibilityResult([]);
        }

        candidateResults.push(...result.reasons);
      }
    }

    reasons.push(...candidateResults);

    if (context?.runtime) {
      if (
        !sourceNode.definition.capabilities.supportsRuntime(context.runtime) ||
        !targetNode.definition.capabilities.supportsRuntime(context.runtime)
      ) {
        addReason(reasons, {
          code: "node-runtime-mismatch",
          severity: "incompatible",
          message: `One or both nodes do not support runtime '${context.runtime}'.`,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
        });
      }
    }

    if (context?.task) {
      if (
        !sourceNode.definition.capabilities.supportsTask(context.task) ||
        !targetNode.definition.capabilities.supportsTask(context.task)
      ) {
        addReason(reasons, {
          code: "node-task-mismatch",
          severity: "warning",
          message: `One or both nodes do not explicitly support task '${context.task}'.`,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
        });
      }
    }

    return new NodeCompatibilityResult(reasons);
  }

  public evaluateNodeDefinitionCompatibility(
    node: INode,
    definition: INodeDefinition,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult {
    const reasons: INodeCompatibilityReason[] = [];

    if (context?.runtime && !definition.capabilities.supportsRuntime(context.runtime)) {
      addReason(reasons, {
        code: "node-runtime-mismatch",
        severity: "incompatible",
        message: `Node definition '${definition.type}' does not support runtime '${context.runtime}'.`,
        sourceNodeId: node.id,
      });
    }

    if (context?.task && !definition.capabilities.supportsTask(context.task)) {
      addReason(reasons, {
        code: "node-task-mismatch",
        severity: "warning",
        message: `Node definition '${definition.type}' does not explicitly support task '${context.task}'.`,
        sourceNodeId: node.id,
      });
    }

    const currentPropertyIds = new Set(node.properties.map((property) => property.id));
    const definitionPropertyIds = new Set(definition.properties.map((property) => property.id));

    for (const propertyId of currentPropertyIds) {
      if (!definitionPropertyIds.has(propertyId)) {
        addReason(reasons, {
          code: "custom",
          severity: "warning",
          message: `Node property '${propertyId}' is not present in the target definition '${definition.type}'.`,
          sourceNodeId: node.id,
          propertyId,
        });
      }
    }

    return new NodeCompatibilityResult(reasons);
  }

  public evaluatePropertyModelCompatibility(
    property: INodeProperty,
    model: IModel,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult {
    const reasons: INodeCompatibilityReason[] = [];

    if (!property.isModelBound()) {
      return new NodeCompatibilityResult(reasons);
    }

    if (property.bindingProfile?.modelCompatibility) {
      const result =
        this.modelCompatibilityService.evaluateModelToProfileCompatibility(
          model,
          property.bindingProfile.modelCompatibility,
          {
            runtime: context?.runtime,
            task: context?.task,
            inputModality: context?.modality,
            requireAvailable: false,
          }
        );

      if (!result.isCompatible) {
        addReason(reasons, {
          code: "property-model-compatibility-mismatch",
          severity: "incompatible",
          message: `Model '${model.id}' is not compatible with property '${property.id}'.`,
          propertyId: property.id,
        });
      }

      reasons.push(...result.reasons.map((reason) => ({
        code: "property-model-compatibility-mismatch" as const,
        severity: reason.severity,
        message: reason.message,
        propertyId: property.id,
      })));
    }

    if (
      context?.runtime &&
      property.bindingProfile?.runtimes &&
      property.bindingProfile.runtimes.length > 0 &&
      !property.bindingProfile.runtimes.includes(context.runtime)
    ) {
      addReason(reasons, {
        code: "property-runtime-mismatch",
        severity: "incompatible",
        message: `Property '${property.id}' does not support runtime '${context.runtime}'.`,
        propertyId: property.id,
      });
    }

    if (
      property.bindingProfile?.dependencyConstraints &&
      property.bindingProfile.dependencyConstraints.length > 0
    ) {
      const dependencyCompatible = property.bindingProfile.dependencyConstraints.some(
        (dependency) => dependency.isSatisfiedBy(model)
      );

      if (!dependencyCompatible) {
        addReason(reasons, {
          code: "property-model-compatibility-mismatch",
          severity: "warning",
          message: `Model '${model.id}' does not satisfy the dependency constraints for property '${property.id}'.`,
          propertyId: property.id,
        });
      }
    }

    return new NodeCompatibilityResult(reasons);
  }

  public evaluateNodeModelCompatibility(
    node: INode,
    modelCompatibility: IModelCompatibility,
    context?: INodeCompatibilityContext
  ): INodeCompatibilityResult {
    const reasons: INodeCompatibilityReason[] = [];

    const definitionCompatibility = node.definition.capabilities.modelCompatibility;

    if (definitionCompatibility) {
      const result =
        this.modelCompatibilityService.evaluateProfileToProfileCompatibility(
          definitionCompatibility,
          modelCompatibility,
          {
            runtime: context?.runtime,
            task: context?.task,
            inputModality: context?.modality,
          }
        );

      if (!result.isCompatible) {
        addReason(reasons, {
          code: "node-model-compatibility-mismatch",
          severity: "incompatible",
          message: `Node '${node.id}' is not compatible with the provided model profile.`,
          sourceNodeId: node.id,
        });
      }

      reasons.push(...result.reasons.map((reason) => ({
        code: "node-model-compatibility-mismatch" as const,
        severity: reason.severity,
        message: reason.message,
        sourceNodeId: node.id,
      })));
    }

    if (node.executionProfile?.modelCompatibility) {
      const result =
        this.modelCompatibilityService.evaluateProfileToProfileCompatibility(
          node.executionProfile.modelCompatibility,
          modelCompatibility,
          {
            runtime: context?.runtime,
            task: context?.task,
            inputModality: context?.modality,
          }
        );

      if (!result.isCompatible) {
        addReason(reasons, {
          code: "node-model-compatibility-mismatch",
          severity: "incompatible",
          message: `Node '${node.id}' execution profile is not compatible with the provided model profile.`,
          sourceNodeId: node.id,
        });
      }
    }

    if (context?.runtime && node.executionProfile?.runtime) {
      if (node.executionProfile.runtime !== context.runtime) {
        addReason(reasons, {
          code: "node-runtime-mismatch",
          severity: "incompatible",
          message: `Node '${node.id}' is configured for runtime '${node.executionProfile.runtime}', not '${context.runtime}'.`,
          sourceNodeId: node.id,
        });
      }
    }

    return new NodeCompatibilityResult(reasons);
  }
}

