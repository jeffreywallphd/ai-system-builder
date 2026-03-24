function freezeRecord(
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  return metadata ? Object.freeze({ ...metadata }) : undefined;
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export type AssetTransformationStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export class AssetTransformation {
  public readonly transformationId: string;
  public readonly kind: string;
  public readonly status: AssetTransformationStatus;
  public readonly inputVersionIds: ReadonlyArray<string>;
  public readonly outputVersionIds: ReadonlyArray<string>;
  public readonly workflowId?: string;
  public readonly nodeId?: string;
  public readonly executionId?: string;
  public readonly runtime?: string;
  public readonly provider?: string;
  public readonly modelId?: string;
  public readonly diagnostics?: Readonly<Record<string, unknown>>;
  public readonly metadata?: Readonly<Record<string, unknown>>;
  public readonly startedAt?: Date;
  public readonly completedAt?: Date;
  public readonly createdAt: Date;

  constructor(params: {
    transformationId: string;
    kind: string;
    status: AssetTransformationStatus;
    inputVersionIds?: ReadonlyArray<string>;
    outputVersionIds?: ReadonlyArray<string>;
    workflowId?: string;
    nodeId?: string;
    executionId?: string;
    runtime?: string;
    provider?: string;
    modelId?: string;
    diagnostics?: Readonly<Record<string, unknown>>;
    metadata?: Readonly<Record<string, unknown>>;
    startedAt?: Date;
    completedAt?: Date;
    createdAt?: Date;
  }) {
    const transformationId = params.transformationId.trim();
    if (!transformationId) {
      throw new Error("AssetTransformation.transformationId cannot be empty.");
    }

    const kind = params.kind.trim().toLowerCase();
    if (!kind) {
      throw new Error("AssetTransformation.kind cannot be empty.");
    }

    const inputVersionIds = [...new Set((params.inputVersionIds ?? []).map((entry) => entry.trim()).filter(Boolean))];
    const outputVersionIds = [...new Set((params.outputVersionIds ?? []).map((entry) => entry.trim()).filter(Boolean))];
    if (inputVersionIds.length === 0 && outputVersionIds.length === 0) {
      throw new Error("AssetTransformation must include at least one input or output version.");
    }

    this.transformationId = transformationId;
    this.kind = kind;
    this.status = params.status;
    this.inputVersionIds = Object.freeze(inputVersionIds);
    this.outputVersionIds = Object.freeze(outputVersionIds);
    this.workflowId = normalizeOptionalString(params.workflowId);
    this.nodeId = normalizeOptionalString(params.nodeId);
    this.executionId = normalizeOptionalString(params.executionId);
    this.runtime = normalizeOptionalString(params.runtime);
    this.provider = normalizeOptionalString(params.provider);
    this.modelId = normalizeOptionalString(params.modelId);
    this.diagnostics = freezeRecord(params.diagnostics);
    this.metadata = freezeRecord(params.metadata);
    this.startedAt = params.startedAt ? new Date(params.startedAt.getTime()) : undefined;
    this.completedAt = params.completedAt ? new Date(params.completedAt.getTime()) : undefined;
    this.createdAt = params.createdAt ? new Date(params.createdAt.getTime()) : new Date();

    if (this.startedAt && this.completedAt && this.completedAt.getTime() < this.startedAt.getTime()) {
      throw new Error("AssetTransformation.completedAt cannot be earlier than startedAt.");
    }
  }
}
