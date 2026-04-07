import { Model, ModelArtifact, ModelSource } from "../../../src/domain/models/Model";
import { ModelCompatibility } from "../../../src/domain/models/ModelCompatibility";
import { ModelDependency } from "../../../src/domain/models/ModelDependency";
import { ModelRequirement } from "../../../src/domain/models/ModelRequirement";
import { Node } from "../../nodes/Node";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../../nodes/NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../../nodes/NodePort";
import { NodeProperty, NodePropertyBindingProfile } from "../../nodes/NodeProperty";
import { Workflow } from "../../workflows/Workflow";
import { WorkflowConnection } from "../../workflows/WorkflowConnection";
import { WorkflowMetadata } from "../../workflows/WorkflowMetadata";
import type { RuntimeEngine } from "../../../src/domain/models/interfaces/IModelCompatibility";

export function makeCompatibility(overrides: ConstructorParameters<typeof ModelCompatibility>[0] = {}) {
  return new ModelCompatibility({
    inputModalities: ["text"],
    outputModalities: ["text"],
    supportedTasks: ["chat"],
    supportedRuntimes: ["vllm"],
    architectureFamilies: ["llama"],
    ...overrides,
  });
}

export function makeModel(id: string, overrides: Partial<ConstructorParameters<typeof Model>[0]> = {}) {
  return new Model({
    id,
    name: id,
    kind: "generic",
    source: new ModelSource({ type: "local" }),
    artifact: new ModelArtifact({ name: `${id}.bin`, accessMethod: "local-file", format: "gguf" }),
    compatibility: makeCompatibility(),
    dependencies: [],
    requirements: [],
    status: "available",
    ...overrides,
  });
}

export function makeNodePort(params: {
  id: string;
  direction: "input" | "output";
  valueTypes?: ReadonlyArray<string>;
  runtimes?: ReadonlyArray<RuntimeEngine>;
  tasks?: ReadonlyArray<string>;
  modalities?: ReadonlyArray<string>;
  isControlPort?: boolean;
  cardinality?: "one" | "many";
  modelCompatibility?: ModelCompatibility;
  dependencyConstraints?: ReadonlyArray<ModelDependency>;
}) {
  return new NodePort({
    id: params.id,
    name: params.id,
    direction: params.direction,
    cardinality: params.cardinality,
    isControlPort: params.isControlPort,
    compatibility: new NodePortCompatibilityProfile({
      valueTypes: params.valueTypes as any,
      runtimes: params.runtimes,
      tasks: params.tasks as any,
      modalities: params.modalities as any,
      modelCompatibility: params.modelCompatibility,
      dependencyConstraints: params.dependencyConstraints,
    }),
  });
}

export function makeNode(params: {
  id: string;
  inputPorts?: ReadonlyArray<NodePort>;
  outputPorts?: ReadonlyArray<NodePort>;
  properties?: ReadonlyArray<NodeProperty>;
  runtimes?: ReadonlyArray<RuntimeEngine>;
  tasks?: ReadonlyArray<string>;
  modelCompatibility?: ModelCompatibility;
  isEnabled?: boolean;
  executionRuntime?: RuntimeEngine;
  executionModelCompatibility?: ModelCompatibility;
}) {
  const definition = new NodeDefinition({
    id: `def-${params.id}`,
    type: `type-${params.id}`,
    title: params.id,
    category: "utility",
    inputPorts:
      params.inputPorts ??
      [makeNodePort({ id: "in", direction: "input", valueTypes: ["text"] })],
    outputPorts:
      params.outputPorts ??
      [makeNodePort({ id: "out", direction: "output", valueTypes: ["text"] })],
    properties:
      params.properties ??
      [
        new NodeProperty({
          id: "required",
          name: "Required",
          type: "text",
          value: "ok",
          constraints: { required: true },
        }),
      ],
    capabilities: new NodeDefinitionCapabilityProfile({
      runtimes: params.runtimes,
      tasks: params.tasks as any,
      modelCompatibility: params.modelCompatibility,
    }),
  });

  return new Node({
    id: params.id,
    definition,
    isEnabled: params.isEnabled,
    executionProfile:
      params.executionRuntime || params.executionModelCompatibility
        ? {
            runtime: params.executionRuntime,
            modelCompatibility: params.executionModelCompatibility,
          }
        : undefined,
  });
}

export function makeModelBoundProperty(overrides: Partial<ConstructorParameters<typeof NodeProperty>[0]> = {}) {
  return new NodeProperty({
    id: "model",
    name: "Model",
    type: "model-reference",
    value: "model-a",
    bindingProfile: new NodePropertyBindingProfile({
      modelCompatibility: makeCompatibility(),
      runtimes: ["vllm"],
    }),
    ...overrides,
  });
}

export function makeConnection(id: string, sourceNodeId: string, targetNodeId: string, sourcePortId = "out", targetPortId = "in") {
  return new WorkflowConnection({
    id,
    source: { nodeId: sourceNodeId, portId: sourcePortId },
    target: { nodeId: targetNodeId, portId: targetPortId },
  });
}

export function makeWorkflow(params: {
  id?: string;
  nodes?: ReadonlyArray<Node>;
  connections?: ReadonlyArray<WorkflowConnection>;
  executionPolicy?: "acyclic-only" | "allow-cycles";
  isEnabled?: boolean;
  runtimeProfile?: ConstructorParameters<typeof Workflow>[0]["runtimeProfile"];
}) {
  return new Workflow({
    id: params.id ?? "wf",
    metadata: new WorkflowMetadata({ name: "Workflow" }),
    nodes: params.nodes,
    connections: params.connections,
    executionPolicy: params.executionPolicy,
    isEnabled: params.isEnabled,
    runtimeProfile: params.runtimeProfile,
  });
}

export { ModelDependency, ModelRequirement, ModelCompatibility, NodePropertyBindingProfile };
