import { createSystemContextContract, type SystemContextContract } from "../system-studio/SystemContextContract";

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRecord(value?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.freeze({ ...value });
}

export const ImageStudioHandoffContractVersion = "1.0.0";

export interface ImageAssetReference {
  readonly assetId: string;
}

export interface VersionedImageAssetReference extends ImageAssetReference {
  readonly versionId: string;
}

export interface DatasetInstanceReference {
  readonly referenceId: string;
  readonly instanceId: string;
  readonly dataset: VersionedImageAssetReference;
  readonly role: "input" | "output" | "history" | "comparison" | "runtime-store";
  readonly schemaIntentId?: string;
}

export interface WorkflowReference {
  readonly workflow: VersionedImageAssetReference;
  readonly bindingId?: string;
}

export interface SystemBindingReference {
  readonly system: VersionedImageAssetReference;
  readonly workflow: WorkflowReference;
  readonly datasets: ReadonlyArray<DatasetInstanceReference>;
}

export interface ImageRuntimeInputPayload {
  readonly context: SystemContextContract;
  readonly workflow: WorkflowReference;
  readonly systemBinding: SystemBindingReference;
  readonly trace: {
    readonly handoffId: string;
    readonly traceId: string;
    readonly sourceStudioType: string;
    readonly sourceStudioId: string;
  };
}

export interface ImageRuntimeOutputAsset {
  readonly outputId: string;
  readonly image: VersionedImageAssetReference;
  readonly targetDatasetReferenceId?: string;
}

export interface ImageRuntimeOutputPayload {
  readonly runId: string;
  readonly status: "succeeded" | "failed";
  readonly outputs: ReadonlyArray<ImageRuntimeOutputAsset>;
  readonly issues: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly path?: string;
  }>;
  readonly trace: {
    readonly handoffId: string;
    readonly traceId: string;
    readonly workflowAssetId: string;
    readonly workflowVersionId: string;
    readonly systemAssetId: string;
    readonly systemVersionId: string;
  };
}

export interface ImageHandoffEventPayload {
  readonly eventId: string;
  readonly eventType: "handoff-launched" | "handoff-resolved" | "runtime-started" | "runtime-completed" | "runtime-failed";
  readonly occurredAt: string;
  readonly traceId: string;
  readonly handoffId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface PersistedImageCrossStudioRelationship {
  readonly relationshipId: string;
  readonly relationshipType:
    | "dataset-instance-binding"
    | "workflow-binding"
    | "system-binding"
    | "runtime-output-link";
  readonly sourceRef: VersionedImageAssetReference;
  readonly targetRef: VersionedImageAssetReference;
  readonly datasetInstanceRef?: DatasetInstanceReference;
  readonly workflowRef?: WorkflowReference;
  readonly systemRef?: VersionedImageAssetReference;
  readonly traceId: string;
  readonly handoffId: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageCrossStudioHandoffContract {
  readonly contractVersion: string;
  readonly handoffId: string;
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly targetStudioType: string;
  readonly targetStudioId: string;
  readonly primaryAsset: VersionedImageAssetReference;
  readonly referencedAssets: ReadonlyArray<VersionedImageAssetReference>;
  readonly datasetInstances: ReadonlyArray<DatasetInstanceReference>;
  readonly workflow: WorkflowReference;
  readonly systemBinding: SystemBindingReference;
  readonly runtimeInput: ImageRuntimeInputPayload;
  readonly runtimeOutput?: ImageRuntimeOutputPayload;
  readonly events: ReadonlyArray<ImageHandoffEventPayload>;
  readonly persistedRelationships: ReadonlyArray<PersistedImageCrossStudioRelationship>;
}

function normalizeVersionedReference(reference: VersionedImageAssetReference, label: string): VersionedImageAssetReference {
  return Object.freeze({
    assetId: normalizeRequired(reference.assetId, `${label} assetId`),
    versionId: normalizeRequired(reference.versionId, `${label} versionId`),
  });
}

function normalizeDatasetInstanceReference(
  reference: DatasetInstanceReference,
  index: number,
): DatasetInstanceReference {
  return Object.freeze({
    referenceId: normalizeRequired(reference.referenceId, `Dataset instance reference[${index}] referenceId`),
    instanceId: normalizeRequired(reference.instanceId, `Dataset instance reference[${index}] instanceId`),
    dataset: normalizeVersionedReference(reference.dataset, `Dataset instance reference[${index}] dataset`),
    role: reference.role,
    schemaIntentId: normalizeOptional(reference.schemaIntentId),
  });
}

export function createImageCrossStudioHandoffContract(
  input: ImageCrossStudioHandoffContract,
): ImageCrossStudioHandoffContract {
  const datasetInstances = (input.datasetInstances ?? []).map((entry, index) => normalizeDatasetInstanceReference(entry, index));
  const seenDatasetReferenceIds = new Set<string>();
  datasetInstances.forEach((entry) => {
    if (seenDatasetReferenceIds.has(entry.referenceId)) {
      throw new Error(`Duplicate dataset instance reference '${entry.referenceId}'.`);
    }
    seenDatasetReferenceIds.add(entry.referenceId);
  });

  const referencedAssets = (input.referencedAssets ?? []).map((entry, index) => normalizeVersionedReference(entry, `Referenced asset[${index}]`));
  const uniqueAssetKeys = new Set<string>();
  const dedupedReferencedAssets = referencedAssets.filter((entry) => {
    const key = `${entry.assetId}::${entry.versionId}`;
    if (uniqueAssetKeys.has(key)) {
      return false;
    }
    uniqueAssetKeys.add(key);
    return true;
  });

  return Object.freeze({
    contractVersion: normalizeOptional(input.contractVersion) ?? ImageStudioHandoffContractVersion,
    handoffId: normalizeRequired(input.handoffId, "Image cross-studio handoff id"),
    sourceStudioType: normalizeRequired(input.sourceStudioType, "Image cross-studio source studio type"),
    sourceStudioId: normalizeRequired(input.sourceStudioId, "Image cross-studio source studio id"),
    targetStudioType: normalizeRequired(input.targetStudioType, "Image cross-studio target studio type"),
    targetStudioId: normalizeRequired(input.targetStudioId, "Image cross-studio target studio id"),
    primaryAsset: normalizeVersionedReference(input.primaryAsset, "Primary asset"),
    referencedAssets: Object.freeze(dedupedReferencedAssets),
    datasetInstances: Object.freeze(datasetInstances),
    workflow: Object.freeze({
      workflow: normalizeVersionedReference(input.workflow.workflow, "Workflow reference"),
      bindingId: normalizeOptional(input.workflow.bindingId),
    }),
    systemBinding: Object.freeze({
      system: normalizeVersionedReference(input.systemBinding.system, "System binding"),
      workflow: Object.freeze({
        workflow: normalizeVersionedReference(input.systemBinding.workflow.workflow, "System binding workflow"),
        bindingId: normalizeOptional(input.systemBinding.workflow.bindingId),
      }),
      datasets: Object.freeze((input.systemBinding.datasets ?? []).map((entry, index) => normalizeDatasetInstanceReference(entry, index))),
    }),
    runtimeInput: Object.freeze({
      context: createSystemContextContract(input.runtimeInput.context),
      workflow: Object.freeze({
        workflow: normalizeVersionedReference(input.runtimeInput.workflow.workflow, "Runtime input workflow"),
        bindingId: normalizeOptional(input.runtimeInput.workflow.bindingId),
      }),
      systemBinding: Object.freeze({
        system: normalizeVersionedReference(input.runtimeInput.systemBinding.system, "Runtime input system binding"),
        workflow: Object.freeze({
          workflow: normalizeVersionedReference(input.runtimeInput.systemBinding.workflow.workflow, "Runtime input system binding workflow"),
          bindingId: normalizeOptional(input.runtimeInput.systemBinding.workflow.bindingId),
        }),
        datasets: Object.freeze((input.runtimeInput.systemBinding.datasets ?? []).map((entry, index) => normalizeDatasetInstanceReference(entry, index))),
      }),
      trace: Object.freeze({
        handoffId: normalizeRequired(input.runtimeInput.trace.handoffId, "Runtime input trace handoffId"),
        traceId: normalizeRequired(input.runtimeInput.trace.traceId, "Runtime input trace traceId"),
        sourceStudioType: normalizeRequired(input.runtimeInput.trace.sourceStudioType, "Runtime input trace sourceStudioType"),
        sourceStudioId: normalizeRequired(input.runtimeInput.trace.sourceStudioId, "Runtime input trace sourceStudioId"),
      }),
    }),
    runtimeOutput: input.runtimeOutput
      ? Object.freeze({
        runId: normalizeRequired(input.runtimeOutput.runId, "Runtime output runId"),
        status: input.runtimeOutput.status,
        outputs: Object.freeze((input.runtimeOutput.outputs ?? []).map((entry, index) => Object.freeze({
          outputId: normalizeRequired(entry.outputId, `Runtime output[${index}] outputId`),
          image: normalizeVersionedReference(entry.image, `Runtime output[${index}] image`),
          targetDatasetReferenceId: normalizeOptional(entry.targetDatasetReferenceId),
        }))),
        issues: Object.freeze([...(input.runtimeOutput.issues ?? [])].map((issue) => Object.freeze({
          code: normalizeRequired(issue.code, "Runtime output issue code"),
          message: normalizeRequired(issue.message, "Runtime output issue message"),
          path: normalizeOptional(issue.path),
        }))),
        trace: Object.freeze({
          handoffId: normalizeRequired(input.runtimeOutput.trace.handoffId, "Runtime output trace handoffId"),
          traceId: normalizeRequired(input.runtimeOutput.trace.traceId, "Runtime output trace traceId"),
          workflowAssetId: normalizeRequired(input.runtimeOutput.trace.workflowAssetId, "Runtime output trace workflowAssetId"),
          workflowVersionId: normalizeRequired(input.runtimeOutput.trace.workflowVersionId, "Runtime output trace workflowVersionId"),
          systemAssetId: normalizeRequired(input.runtimeOutput.trace.systemAssetId, "Runtime output trace systemAssetId"),
          systemVersionId: normalizeRequired(input.runtimeOutput.trace.systemVersionId, "Runtime output trace systemVersionId"),
        }),
      })
      : undefined,
    events: Object.freeze((input.events ?? []).map((event, index) => Object.freeze({
      eventId: normalizeRequired(event.eventId, `Handoff event[${index}] eventId`),
      eventType: event.eventType,
      occurredAt: normalizeRequired(event.occurredAt, `Handoff event[${index}] occurredAt`),
      traceId: normalizeRequired(event.traceId, `Handoff event[${index}] traceId`),
      handoffId: normalizeRequired(event.handoffId, `Handoff event[${index}] handoffId`),
      payload: normalizeRecord(event.payload) ?? Object.freeze({}),
    }))),
    persistedRelationships: Object.freeze((input.persistedRelationships ?? []).map((relationship, index) => Object.freeze({
      relationshipId: normalizeRequired(relationship.relationshipId, `Persisted relationship[${index}] relationshipId`),
      relationshipType: relationship.relationshipType,
      sourceRef: normalizeVersionedReference(relationship.sourceRef, `Persisted relationship[${index}] sourceRef`),
      targetRef: normalizeVersionedReference(relationship.targetRef, `Persisted relationship[${index}] targetRef`),
      datasetInstanceRef: relationship.datasetInstanceRef
        ? normalizeDatasetInstanceReference(relationship.datasetInstanceRef, index)
        : undefined,
      workflowRef: relationship.workflowRef
        ? Object.freeze({
          workflow: normalizeVersionedReference(relationship.workflowRef.workflow, `Persisted relationship[${index}] workflowRef`),
          bindingId: normalizeOptional(relationship.workflowRef.bindingId),
        })
        : undefined,
      systemRef: relationship.systemRef
        ? normalizeVersionedReference(relationship.systemRef, `Persisted relationship[${index}] systemRef`)
        : undefined,
      traceId: normalizeRequired(relationship.traceId, `Persisted relationship[${index}] traceId`),
      handoffId: normalizeRequired(relationship.handoffId, `Persisted relationship[${index}] handoffId`),
      createdAt: normalizeRequired(relationship.createdAt, `Persisted relationship[${index}] createdAt`),
      metadata: normalizeRecord(relationship.metadata),
    }))),
  });
}
