import type {
  IComfyAdapterRequest,
  IComfyAdapterExecutionContext,
} from "../../../../application/execution/comfyui/ComfyAdapterContract";
import type { ComfyWorkflowDto } from "../../dto/ComfyWorkflowDto";
import { ComfyWorkflowAdapter } from "../../adapters/ComfyWorkflowAdapter";

export interface IComfyMappedExecutionRequest {
  readonly payload: ComfyWorkflowDto;
  readonly executionContext: IComfyAdapterExecutionContext;
}

export interface IComfyExecutionRequestMapperOptions {
  readonly workflowAdapter?: ComfyWorkflowAdapter;
}

export class ComfyExecutionRequestMapper {
  private readonly workflowAdapter: ComfyWorkflowAdapter;

  constructor(options?: IComfyExecutionRequestMapperOptions) {
    this.workflowAdapter = options?.workflowAdapter ?? new ComfyWorkflowAdapter();
  }

  public map(request: IComfyAdapterRequest): IComfyMappedExecutionRequest {
    const workflow = applyPropertyOverrides(request.workflow, request.propertyOverrides);
    const payload = this.workflowAdapter.adaptWorkflowEnvelope(workflow);

    return Object.freeze({
      payload,
      executionContext: Object.freeze({
        identifiers: Object.freeze({ ...(request.context?.identifiers ?? { workflowId: request.workflow.id }) }),
        system: request.context?.system
          ? Object.freeze({ ...request.context.system })
          : Object.freeze({}),
        datasets: Object.freeze({
          datasetAssetRefs: Object.freeze([...(request.context?.datasets.datasetAssetRefs ?? [])]),
          datasetInstanceRefs: Object.freeze([...(request.context?.datasets.datasetInstanceRefs ?? [])]),
        }),
        inputs: Object.freeze({
          selectedAssetRefs: Object.freeze([
            ...(request.context?.inputs.selectedAssetRefs ?? request.inputAssetRefs ?? []),
          ]),
        }),
        runtime: Object.freeze({
          parameters: Object.freeze({ ...(request.context?.runtime.parameters ?? request.runtimeParameters ?? {}) }),
          options: Object.freeze({ ...(request.context?.runtime.options ?? {}) }),
        }),
        trigger: request.context?.trigger
          ? Object.freeze({
              ...request.context.trigger,
              metadata: request.context.trigger.metadata
                ? Object.freeze({ ...request.context.trigger.metadata })
                : undefined,
            })
          : undefined,
        observability: request.context?.observability
          ? Object.freeze({
              ...request.context.observability,
              tags: Object.freeze([...(request.context.observability.tags ?? [])]),
            })
          : undefined,
        metadata: Object.freeze({ ...(request.context?.metadata ?? {}) }),
      }),
    });
  }
}

function applyPropertyOverrides(
  workflow: IComfyAdapterRequest["workflow"],
  overrides?: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): IComfyAdapterRequest["workflow"] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return workflow;
  }

  let updatedWorkflow = workflow;

  for (const [nodeId, propertyOverrides] of Object.entries(overrides)) {
    const node = updatedWorkflow.getNode(nodeId);

    if (!node) {
      throw new Error(`Property overrides reference unknown node '${nodeId}'.`);
    }

    let updatedNode = node;

    for (const [propertyId, value] of Object.entries(propertyOverrides)) {
      if (!updatedNode.getProperty(propertyId)) {
        throw new Error(
          `Property overrides reference unknown property '${propertyId}' on node '${nodeId}'.`,
        );
      }

      updatedNode = updatedNode.withPropertyValue(propertyId, value);
    }

    updatedWorkflow = updatedWorkflow.updateNode(updatedNode);
  }

  return updatedWorkflow;
}
