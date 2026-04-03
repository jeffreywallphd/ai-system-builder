import {
  ComfyImageManipulationExecutionContractVersion,
  type ComfyImageManipulationExecutionSubmission,
  type ComfyImageManipulationGraphBuildRequest,
  type ComfyImageManipulationMaterializationBinding,
  type ComfyPromptGraphNode,
} from "./ComfyImageManipulationExecutionAdapterContract";
import {
  ComfyImageManipulationBaseGraph,
  ComfyImageManipulationBaseGraphContractVersion,
  createComfyImageManipulationBaseGraph,
} from "./ComfyImageManipulationBaseGraph";
import {
  resolveComfyImageManipulationGraphBindings,
  type ComfyNodeInputOverride,
  type ResolveComfyImageManipulationGraphBindingsResult,
} from "./ComfyImageManipulationPropertyMappingAsset";
import { resolveComfyInputDatasetBinding } from "./ComfyImageManipulationDatasetBindingAsset";

const TEMPLATE_IDS = new Set([
  "asset:workflow-template:image-manipulation:default",
  "asset:workflow-template:image-to-image:starter",
]);

interface ComfyExecutionPathStrategy {
  readonly pathKind: "non-faceid" | "faceid";
  validate(mapping: ResolveComfyImageManipulationGraphBindingsResult): void;
  selectOverrides(mapping: ResolveComfyImageManipulationGraphBindingsResult): ReadonlyArray<ComfyNodeInputOverride>;
}

const NonFaceIdExecutionPathStrategy: ComfyExecutionPathStrategy = Object.freeze({
  pathKind: "non-faceid",
  validate: () => undefined,
  selectOverrides: (mapping) => mapping.directNodeOverrides,
});

const FaceIdExecutionPathStrategy: ComfyExecutionPathStrategy = Object.freeze({
  pathKind: "faceid",
  validate: (mapping) => {
    const faceId = mapping.subworkflowBindings[0];
    if (!faceId?.enabled) {
      throw new Error("invalid-request:FaceID execution strategy requires FaceID to be enabled.");
    }
    if (!faceId.model || faceId.model.trim().length < 1) {
      throw new Error("invalid-request:FaceID model selection is required when FaceID is enabled.");
    }
    if (faceId.referenceBindings.length < 1) {
      throw new Error("invalid-request:FaceID reference dataset bindings are required when FaceID is enabled.");
    }
  },
  selectOverrides: (mapping) => mapping.nodeOverrides,
});

export function buildComfyImageManipulationExecutionSubmission(
  request: ComfyImageManipulationGraphBuildRequest,
): ComfyImageManipulationExecutionSubmission {
  if (request.contractVersion !== ComfyImageManipulationExecutionContractVersion) {
    throw new Error(`invalid-request:Unsupported Comfy image manipulation execution contract version '${request.contractVersion}'.`);
  }

  if (!TEMPLATE_IDS.has(request.workflowTemplate.templateId)) {
    throw new Error(`invalid-request:Unsupported image manipulation template '${request.workflowTemplate.templateId}'.`);
  }

  const graph = createComfyImageManipulationBaseGraph(request.baseGraph ?? ComfyImageManipulationBaseGraph);
  const mapping = resolveComfyImageManipulationGraphBindings(request.resolvedConfig);
  const sourceDatasetBinding = resolveComfyInputDatasetBinding({ handles: request.datasetHandles });
  const strategy = resolveExecutionPathStrategy(mapping);
  strategy.validate(mapping);

  const prompt = mapPromptGraph(
    graph,
    strategy.selectOverrides(mapping),
    sourceDatasetBinding.datasetRef.logicalRef,
    request.resolvedConfig as unknown as Record<string, unknown>,
  );
  const materializationBindings = resolveMaterializationBindings(request);
  const executionRequestId = request.runtimeMetadata.executionId
    ?? `${request.workflowTemplate.templateId}:${Date.now().toString(36)}`;

  return Object.freeze({
    contractVersion: ComfyImageManipulationExecutionContractVersion,
    executionRequestId,
    graph: Object.freeze({
      prompt,
      outputNodeIds: Object.freeze([...graph.outputNodeIds]),
    }),
    sourceDatasetBinding,
    runtimeMetadata: Object.freeze({ ...request.runtimeMetadata }),
    materializationBindings,
    inspection: Object.freeze({
      graphAssetId: graph.assetId,
      graphContractVersion: ComfyImageManipulationBaseGraphContractVersion,
      templateId: request.workflowTemplate.templateId,
      templateVersionId: request.workflowTemplate.versionId,
      nodeCount: graph.nodes.length,
      boundInputCount: countBoundInputs(prompt),
      executionPath: strategy.pathKind,
      extensionBindings: Object.freeze(mapping.extensionNodeOverrides.map((entry) => Object.freeze({ ...entry }))),
      subworkflowBindings: Object.freeze(mapping.subworkflowBindings.map((entry) => Object.freeze({ ...entry }))),
    }),
  });
}

function resolveExecutionPathStrategy(
  mapping: ResolveComfyImageManipulationGraphBindingsResult,
): ComfyExecutionPathStrategy {
  return mapping.subworkflowBindings[0]?.enabled
    ? FaceIdExecutionPathStrategy
    : NonFaceIdExecutionPathStrategy;
}

function mapPromptGraph(
  graph: ReturnType<typeof createComfyImageManipulationBaseGraph>,
  nodeOverrides: ReadonlyArray<ComfyNodeInputOverride>,
  sourceImageLogicalRef: string,
  resolvedConfig: Readonly<Record<string, unknown>>,
): Readonly<Record<string, ComfyPromptGraphNode>> {
  const prompt: Record<string, ComfyPromptGraphNode> = {};
  const overrideBindings = new Map<string, unknown>(
    nodeOverrides.map((entry) => [`${entry.nodeId}.${entry.inputName}`, entry.value]),
  );
  overrideBindings.set("2.image", sourceImageLogicalRef);

  for (const node of graph.nodes) {
    const mappedInputs: Record<string, unknown> = {};

    for (const [inputName, value] of Object.entries(node.inputs)) {
      const key = `${node.nodeId}.${inputName}`;
      if (overrideBindings.has(key)) {
        mappedInputs[inputName] = overrideBindings.get(key);
        continue;
      }

      mappedInputs[inputName] = resolveInputValue(value, resolvedConfig);
    }

    prompt[node.nodeId] = Object.freeze({
      class_type: node.classType,
      inputs: Object.freeze(mappedInputs),
      _meta: Object.freeze({
        title: node.title,
        purpose: node.purpose,
      }),
    });
  }

  return Object.freeze(prompt);
}

function resolveInputValue(value: unknown, resolvedConfig: Readonly<Record<string, unknown>>): unknown {
  if (typeof value === "string") {
    const token = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(value);
    if (!token) return value;
    const resolved = readConfigPath(resolvedConfig, token[1]);
    if (resolved === undefined) {
      throw new Error(`invalid-request:Unable to resolve Comfy graph token '{{${token[1]}}}'.`);
    }
    return resolved;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => resolveInputValue(entry, resolvedConfig)));
  }

  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveInputValue(entry, resolvedConfig)]),
    ));
  }

  return value;
}

function readConfigPath(config: Readonly<Record<string, unknown>>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[segment];
    }, config);
}

function resolveMaterializationBindings(
  request: ComfyImageManipulationGraphBuildRequest,
): ReadonlyArray<ComfyImageManipulationMaterializationBinding> {
  const bindings = request.workflowTemplate.composition?.outputBindings ?? [];

  return Object.freeze(bindings.map((binding) => Object.freeze({
    bindingId: binding.bindingId,
    targetDatasetAssetId: binding.targetDatasetAssetId ?? "",
    targetDatasetInstanceRef: binding.targetDatasetInstanceRef,
    targetStorageInstanceRef: binding.targetStorageInstanceRef,
    targetStorageBindingId: binding.targetStorageBindingId,
  }))).filter((entry) => entry.targetDatasetAssetId.trim().length > 0);
}

function countBoundInputs(prompt: Readonly<Record<string, ComfyPromptGraphNode>>): number {
  return Object.values(prompt)
    .reduce((total, node) => total + Object.keys(node.inputs).length, 0);
}
