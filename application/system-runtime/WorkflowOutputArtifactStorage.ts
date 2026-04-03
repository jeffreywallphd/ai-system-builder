import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DatasetInstance } from "../../domain/system-runtime/DatasetInstanceDomain";
import type { WorkflowOutputMaterializationPayload } from "./WorkflowOutputMaterializationContract";

export interface PersistWorkflowOutputArtifactRequest {
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly datasetStorageBinding: NonNullable<DatasetInstance["storageBinding"]>;
  readonly workflowRunId: string;
  readonly materializationId: string;
  readonly assetIndex: number;
  readonly role: WorkflowOutputMaterializationPayload["producedAssets"][number]["role"];
  readonly payload: Uint8Array;
  readonly fileNameHint?: string;
  readonly extensionHint?: string;
  readonly mimeTypeHint?: string;
}

export interface PersistWorkflowOutputArtifactResult {
  readonly storageReference: string;
  readonly storageProvider: string;
  readonly assetRef: Readonly<{
    readonly kind: "generated-output";
    readonly stableId: string;
    readonly outputId: string;
    readonly path: string;
    readonly sourceSystem: string;
    readonly sourceContext: Readonly<Record<string, string>>;
    readonly mimeTypeHint?: string;
    readonly formatHint?: string;
  }>;
  readonly metadata: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface WorkflowOutputArtifactStorage {
  persist(request: PersistWorkflowOutputArtifactRequest): Promise<PersistWorkflowOutputArtifactResult>;
}

export class InMemoryWorkflowOutputArtifactStorage implements WorkflowOutputArtifactStorage {
  private readonly storage = new Map<string, Uint8Array>();

  public async persist(request: PersistWorkflowOutputArtifactRequest): Promise<PersistWorkflowOutputArtifactResult> {
    const storageReference = `${request.datasetStorageBinding.bindingReference}/runs/${encodeURIComponent(request.workflowRunId)}/${encodeURIComponent(request.materializationId)}/${request.assetIndex}`;
    this.storage.set(storageReference, request.payload);
    return Object.freeze({
      storageReference,
      storageProvider: "in-memory-storage-instance-output-store",
      assetRef: Object.freeze({
        kind: "generated-output",
        stableId: `generated-output:${storageReference}`,
        outputId: storageReference,
        path: storageReference,
        sourceSystem: "in-memory-storage-instance-output-store",
        sourceContext: Object.freeze({
          storageInstanceId: request.datasetStorageBinding.storageInstanceId,
          storageBindingId: request.datasetStorageBinding.bindingId,
          role: request.role,
          workflowRunId: request.workflowRunId,
        }),
        mimeTypeHint: request.mimeTypeHint,
        formatHint: request.extensionHint,
      }),
      metadata: Object.freeze({
        sizeBytes: request.payload.byteLength,
      }),
    });
  }

  public read(reference: string): Uint8Array | undefined {
    return this.storage.get(reference);
  }
}
