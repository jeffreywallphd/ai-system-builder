import type { CanonicalRecordValue } from "../../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetInstanceImageGenerationRoles,
} from "../../../../domain/system-runtime/DatasetInstanceRecordDomain";
import type {
  IComfyAdapterResult,
} from "../../../../application/execution/comfyui/ComfyAdapterContract";
import {
  validateWorkflowOutputMaterializationPayload,
  type WorkflowOutputMaterializationPayload,
} from "../../../../application/system-runtime/WorkflowOutputMaterializationContract";

export interface ComfyExecutionResultMaterializationMappingRequest {
  readonly workflowRun: {
    readonly runId: string;
    readonly workflowAssetId: string;
    readonly workflowAssetVersionId?: string;
  };
  readonly result: IComfyAdapterResult;
  readonly parameterSnapshot?: Readonly<Record<string, unknown>>;
  readonly sourceImageRef?: WorkflowOutputMaterializationPayload["sourceImage"]["imageRef"];
  readonly materializationId?: string;
  readonly timestamps?: {
    readonly requestedAt?: string;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly updatedAt?: string;
  };
}

export class ComfyExecutionResultMaterializationMapper {
  public map(
    request: ComfyExecutionResultMaterializationMappingRequest,
  ): WorkflowOutputMaterializationPayload {
    const now = new Date().toISOString();
    const producedAssets = request.result.outputs
      .filter((output) => output.kind === "image")
      .map((output, index) => Object.freeze({
        outputIndex: index,
        outputGroupId: this.resolveOutputGroupId(request.result.executionId, output, request.sourceImageRef?.stableId),
        sourceImageRef: request.sourceImageRef,
        assetRef: Object.freeze({
          kind: "generated-output" as const,
          assetId: output.assetRef?.assetId ?? output.reference,
          assetVersionId: output.assetRef?.versionId,
          outputId: output.reference,
          stableId: output.reference,
          path: this.readOptionalString(output.metadata?.filename),
          sourceSystem: "comfyui",
        }),
        role: index === 0
          ? DatasetInstanceImageGenerationRoles.primary
          : DatasetInstanceImageGenerationRoles.variant,
        metadata: this.toCanonicalRecord({
          nodeId: output.nodeId,
          kind: output.kind,
          reference: output.reference,
          ...(output.metadata ?? {}),
        }),
        tags: Object.freeze(this.normalizeTags([output.kind, index === 0 ? "primary" : "variant"])),
      }));

    if (producedAssets.length === 0) {
      throw new Error("invalid-request:Comfy execution result did not contain image outputs for materialization.");
    }

    const payload = {
      materializationId: request.materializationId?.trim() || `mat:${request.result.executionId}`,
      workflowRun: Object.freeze({
        runId: request.workflowRun.runId,
        workflowAssetId: request.workflowRun.workflowAssetId,
        workflowAssetVersionId: request.workflowRun.workflowAssetVersionId,
      }),
      sourceImage: request.sourceImageRef
        ? Object.freeze({ imageRef: request.sourceImageRef })
        : undefined,
      producedAssets: Object.freeze(producedAssets),
      parameterSnapshot: this.toCanonicalRecord(request.parameterSnapshot ?? {}),
      timestamps: Object.freeze({
        requestedAt: request.timestamps?.requestedAt ?? now,
        startedAt: request.timestamps?.startedAt,
        completedAt: request.timestamps?.completedAt,
        updatedAt: request.timestamps?.updatedAt ?? request.timestamps?.completedAt ?? now,
      }),
      status: this.mapStatus(request.result.status),
      error: request.result.error
        ? Object.freeze({
          code: request.result.error.code,
          message: request.result.error.message,
          retriable: request.result.error.retryable,
          details: this.toCanonicalRecord(request.result.error.details ?? request.result.error.diagnostics ?? {}),
        })
        : undefined,
    } satisfies WorkflowOutputMaterializationPayload;

    return validateWorkflowOutputMaterializationPayload(payload);
  }

  private mapStatus(status: IComfyAdapterResult["status"]): WorkflowOutputMaterializationPayload["status"] {
    switch (status) {
      case "completed":
        return "materialized";
      case "failed":
      case "cancelled":
        return "failed";
      default:
        return "partial";
    }
  }

  private readOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeTags(tags: ReadonlyArray<string>): ReadonlyArray<string> {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }

  private resolveOutputGroupId(
    executionId: string,
    output: IComfyAdapterResult["outputs"][number],
    sourceStableId?: string,
  ): string {
    const metadata = this.toCanonicalRecord(output.metadata ?? {});
    const explicitGroupId = this.readOptionalString(metadata.outputGroupId)
      ?? this.readOptionalString(metadata.groupId)
      ?? this.readOptionalString(metadata.batchGroupId)
      ?? this.readOptionalString(sourceStableId);
    return explicitGroupId ?? `run:${executionId}`;
  }

  private toCanonicalRecord(input: unknown): Readonly<Record<string, CanonicalRecordValue>> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return Object.freeze({});
    }

    const entries = Object.entries(input as Record<string, unknown>)
      .map(([key, value]) => [key, this.toCanonicalValue(value)] as const)
      .filter((entry): entry is readonly [string, CanonicalRecordValue] => entry[1] !== undefined);

    return Object.freeze(Object.fromEntries(entries));
  }

  private toCanonicalValue(value: unknown): CanonicalRecordValue | undefined {
    if (value === null) {
      return null;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return Object.freeze(
        value
          .map((entry) => this.toCanonicalValue(entry))
          .filter((entry): entry is CanonicalRecordValue => entry !== undefined),
      );
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, nested]) => [key, this.toCanonicalValue(nested)] as const)
        .filter((entry): entry is readonly [string, CanonicalRecordValue] => entry[1] !== undefined);
      return Object.freeze(Object.fromEntries(entries));
    }
    return undefined;
  }
}
