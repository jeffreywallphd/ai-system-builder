import type { IWorkflowExecutionInput } from "../../ports/interfaces/IWorkflowExecutor";
import type {
  IComfyAdapterAssetReference,
  IComfyAdapterExecutionContext,
} from "./ComfyAdapterContract";

interface IRawExecutionMetadata {
  readonly executionId?: string;
  readonly workflowVersionId?: string;
  readonly parentExecutionId?: string;
  readonly systemId?: string;
  readonly systemRuntimeId?: string;
  readonly datasetAssetRefs?: ReadonlyArray<string>;
  readonly datasetInstanceRefs?: ReadonlyArray<string>;
  readonly runtimeOptions?: Readonly<Record<string, unknown>>;
  readonly triggerSource?: string;
  readonly triggerAction?: string;
  readonly actorId?: string;
  readonly triggerMetadata?: Readonly<Record<string, unknown>>;
  readonly lineageId?: string;
  readonly correlationId?: string;
  readonly tags?: ReadonlyArray<string>;
}

export function createComfyExecutionContext(input: IWorkflowExecutionInput): IComfyAdapterExecutionContext {
  const metadata = input.executionMetadata ?? {};
  const normalizedMetadata = metadata as IRawExecutionMetadata;
  const selectedAssetRefs = Object.freeze((input.inputAssets ?? []).map(toInputAssetRef));

  return Object.freeze({
    identifiers: Object.freeze({
      executionId: asOptionalString(normalizedMetadata.executionId),
      workflowId: input.workflow.id,
      workflowVersionId: asOptionalString(normalizedMetadata.workflowVersionId),
      parentExecutionId: asOptionalString(normalizedMetadata.parentExecutionId),
    }),
    system: Object.freeze({
      systemAssetRef: asOptionalString(normalizedMetadata.systemId),
      systemRuntimeRef: asOptionalString(normalizedMetadata.systemRuntimeId),
    }),
    datasets: Object.freeze({
      datasetAssetRefs: Object.freeze([...(normalizedMetadata.datasetAssetRefs ?? [])]),
      datasetInstanceRefs: Object.freeze([...(normalizedMetadata.datasetInstanceRefs ?? [])]),
    }),
    inputs: Object.freeze({ selectedAssetRefs }),
    runtime: Object.freeze({
      parameters: Object.freeze({ ...(input.parameters ?? {}) }),
      options: Object.freeze({ ...(normalizedMetadata.runtimeOptions ?? {}) }),
    }),
    trigger: normalizedMetadata.triggerSource
      ? Object.freeze({
          source: normalizedMetadata.triggerSource,
          action: asOptionalString(normalizedMetadata.triggerAction),
          actorId: asOptionalString(normalizedMetadata.actorId),
          metadata: normalizedMetadata.triggerMetadata
            ? Object.freeze({ ...normalizedMetadata.triggerMetadata })
            : undefined,
        })
      : undefined,
    observability: (normalizedMetadata.lineageId || normalizedMetadata.correlationId || normalizedMetadata.tags)
      ? Object.freeze({
          lineageId: asOptionalString(normalizedMetadata.lineageId),
          correlationId: asOptionalString(normalizedMetadata.correlationId),
          tags: Object.freeze([...(normalizedMetadata.tags ?? [])]),
        })
      : undefined,
    metadata: Object.freeze({ ...metadata }),
  });
}

function toInputAssetRef(asset: { readonly id: string; readonly latestVersion?: { readonly version: string } }): IComfyAdapterAssetReference {
  return Object.freeze({
    assetId: asset.id,
    versionId: asset.latestVersion?.version,
  });
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
