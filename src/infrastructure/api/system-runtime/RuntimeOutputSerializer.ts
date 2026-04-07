import type { RuntimeExecutionResultReadModel } from "../../../application/system-runtime/SystemRuntimeApplicationService";

export interface SerializedExecutionOutput {
  readonly outputId: string;
  readonly label: string;
  readonly value?: unknown;
  readonly produced: boolean;
}

export interface SerializedExecutionDiagnostics {
  readonly totalCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly entries: RuntimeExecutionResultReadModel["diagnostics"];
}

export interface SerializedExecutionResult {
  readonly identity: {
    readonly executionId: string;
    readonly status: RuntimeExecutionResultReadModel["status"];
    readonly rootAssetId: string;
    readonly rootVersionId?: string;
    readonly completedAt?: string;
    readonly executedVersionMap: RuntimeExecutionResultReadModel["executedVersionMap"];
  };
  readonly summary: {
    readonly hasOutput: boolean;
    readonly hasError: boolean;
    readonly outputFieldCount: number;
    readonly nodeResultCount: number;
    readonly nestedSystemResultCount: number;
  };
  readonly outputs: ReadonlyArray<SerializedExecutionOutput>;
  readonly nestedSystems: RuntimeExecutionResultReadModel["nestedSystemResults"];
  readonly diagnostics: SerializedExecutionDiagnostics;
}

function normalizeLabel(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    return "output";
  }
  return normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export class RuntimeOutputSerializer {
  public serialize(input: RuntimeExecutionResultReadModel): SerializedExecutionResult {
    const outputPayload = input.output?.payload && typeof input.output.payload === "object" && !Array.isArray(input.output.payload)
      ? input.output.payload as Record<string, unknown>
      : {};

    const outputs = Object.freeze(input.outputSummary.contractOutputIds
      .map((outputId) => {
        const value = outputPayload[outputId];
        return Object.freeze({
          outputId,
          label: normalizeLabel(outputId),
          value,
          produced: value !== undefined,
        } satisfies SerializedExecutionOutput);
      })
      .sort((left, right) => left.outputId.localeCompare(right.outputId)));

    const diagnostics = Object.freeze({
      totalCount: input.diagnostics.length,
      errorCount: input.diagnostics.filter((entry) => entry.severity === "error").length,
      warningCount: input.diagnostics.filter((entry) => entry.severity === "warning").length,
      entries: Object.freeze([...input.diagnostics]),
    } satisfies SerializedExecutionDiagnostics);

    return Object.freeze({
      identity: Object.freeze({
        executionId: input.executionId,
        status: input.status,
        rootAssetId: input.rootAssetId,
        rootVersionId: input.rootVersionId,
        completedAt: input.completedAt,
        executedVersionMap: input.executedVersionMap,
      }),
      summary: Object.freeze({
        hasOutput: input.outputSummary.hasOutput,
        hasError: input.outputSummary.hasError,
        outputFieldCount: input.outputSummary.outputFieldCount,
        nodeResultCount: input.nodeResults.length,
        nestedSystemResultCount: input.nestedSystemResults.length,
      }),
      outputs,
      nestedSystems: Object.freeze([...input.nestedSystemResults]),
      diagnostics,
    } satisfies SerializedExecutionResult);
  }
}
