import type { DataPreviewEngineOptions, DataPreviewModel } from "../data-studio/DataPreviewEngine";
import { DataPreviewEngine } from "../data-studio/DataPreviewEngine";
import type { CanonicalDataShape, CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DataAssetBase } from "../../domain/dataset-studio/DataAssetBase";
import {
  DataLineageDiagnosticSeverities,
  DataLineageReferenceKinds,
  DataLineageStepKinds,
  DataLineageStepStatuses,
  createDataLineageDiagnosticNote,
  createDataLineageExecutionStep,
  createDataLineageMetadata,
  createDataLineageReference,
  type DataLineageDiagnosticNote,
  type DataLineageExecutionStep,
  type DataLineageMetadata,
  type DataLineageReference,
} from "../../domain/dataset-studio/DataLineageMetadata";
import { DataConverterCore } from "./DataConverterCore";
import {
  DataConverterDiagnosticSeverities,
  DataConverterOperationKinds,
  createDataConverterDiagnostic,
  normalizeDataConverterContext,
  type DataConverterDiagnostic,
  type DataConverterFailureResult,
  type DataConverterOperationContext,
  type DataConverterRequest,
  type DataConverterResult,
  type DataSourceReference,
  type ResolvedDataSource,
} from "./DataConverterContracts";
import {
  DataStudioFailureKinds,
  createDataStudioFailure,
  summarizeIssueCountByShapeKind,
  toDataConverterDiagnostics,
  type DataStudioFailure,
  type DataStudioValidationIssue,
  validateCanonicalDataShape,
  validateDataAssetExecutionRequest,
  validateDataConverterResult,
  validateDataPreviewModel,
} from "./DataStudioValidation";

export const DataAssetExecutionErrorCodes = Object.freeze({
  invalidRequest: "invalid_request",
  conversionFailed: "conversion_failed",
  outputShapeMismatch: "output_shape_mismatch",
  previewUnsupported: "preview_unsupported",
  executionFailed: "execution_failed",
} as const);

export type DataAssetExecutionErrorCode =
  typeof DataAssetExecutionErrorCodes[keyof typeof DataAssetExecutionErrorCodes];

export const DataAssetExecutionStatuses = Object.freeze({
  succeeded: "succeeded",
  failed: "failed",
} as const);

export type DataAssetExecutionStatus =
  typeof DataAssetExecutionStatuses[keyof typeof DataAssetExecutionStatuses];

export type DataAssetExecutionInput =
  | {
    readonly kind: "source-reference";
    readonly source: DataSourceReference;
    readonly formatHint?: "json" | "csv" | "tsv" | "text";
    readonly delimiter?: "," | "\t" | ";" | "|";
    readonly hasHeaderRow?: boolean;
  }
  | {
    readonly kind: "resolved-source";
    readonly source: ResolvedDataSource;
    readonly formatHint?: "json" | "csv" | "tsv" | "text";
    readonly delimiter?: "," | "\t" | ";" | "|";
    readonly hasHeaderRow?: boolean;
  }
  | {
    readonly kind: "converter-request";
    readonly request: DataConverterRequest;
  }
  | {
    readonly kind: "converter-result";
    readonly result: DataConverterResult;
  }
  | {
    readonly kind: "canonical-shape";
    readonly shape: CanonicalDataShape;
    readonly diagnostics?: ReadonlyArray<DataConverterDiagnostic>;
  };

export interface DataAssetExecutionRequest {
  readonly asset: DataAssetBase;
  readonly input?: DataAssetExecutionInput;
  readonly context?: DataConverterOperationContext;
  readonly requestedBy?: string;
  readonly previewOptions?: DataPreviewEngineOptions;
}

export interface DataAssetExecutionContext {
  readonly executionId: string;
  readonly requestedBy?: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly operationContext: DataConverterOperationContext;
}

export interface DataAssetExecutionResult {
  readonly ok: boolean;
  readonly status: DataAssetExecutionStatus;
  readonly context: DataAssetExecutionContext;
  readonly asset: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly name: string;
  };
  readonly output?: CanonicalDataShape;
  readonly preview: DataPreviewModel;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
  readonly validationIssues: ReadonlyArray<DataStudioValidationIssue>;
  readonly failure?: DataStudioFailure;
  readonly converterResult?: DataConverterResult;
  readonly lineage: DataLineageMetadata;
}

export interface DataAssetExecutionFrameworkOptions {
  readonly converter?: Pick<DataConverterCore, "convert" | "resolveAndConvertSourceToRecords">;
  readonly previewEngine?: Pick<DataPreviewEngine, "buildFromCanonicalShape" | "buildFromConverterResult">;
  readonly now?: () => Date;
  readonly executionIdFactory?: () => string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function toDataConverterFailurePreview(
  previewEngine: Pick<DataPreviewEngine, "buildFromConverterResult">,
  message: string,
  diagnostics: ReadonlyArray<DataConverterDiagnostic>,
): DataPreviewModel {
  const failure: DataConverterFailureResult = Object.freeze({
    ok: false,
    operation: DataConverterOperationKinds.sourceToRecords,
    context: Object.freeze({}),
    diagnostics,
  });
  const preview = previewEngine.buildFromConverterResult(failure);
  if (preview.kind === "error") {
    return Object.freeze({
      ...preview,
      message,
    });
  }
  return preview;
}

function toLineageDiagnostics(diagnostics: ReadonlyArray<DataConverterDiagnostic>): ReadonlyArray<DataLineageDiagnosticNote> {
  return Object.freeze(diagnostics.map((diagnostic) =>
    createDataLineageDiagnosticNote({
      code: diagnostic.code,
      severity: diagnostic.severity === DataConverterDiagnosticSeverities.error
        ? DataLineageDiagnosticSeverities.error
        : diagnostic.severity === DataConverterDiagnosticSeverities.warning
          ? DataLineageDiagnosticSeverities.warning
          : DataLineageDiagnosticSeverities.info,
      message: diagnostic.message,
      path: diagnostic.path,
      details: diagnostic.details as Readonly<Record<string, CanonicalRecordValue>> | undefined,
    })));
}

function createFailureDiagnostic(code: DataAssetExecutionErrorCode, message: string): DataConverterDiagnostic {
  return createDataConverterDiagnostic({
    code,
    severity: DataConverterDiagnosticSeverities.error,
    message,
  });
}

export class DefaultDataAssetExecutionFramework {
  private readonly converter: Pick<DataConverterCore, "convert" | "resolveAndConvertSourceToRecords">;
  private readonly previewEngine: Pick<DataPreviewEngine, "buildFromCanonicalShape" | "buildFromConverterResult">;
  private readonly now: () => Date;
  private readonly executionIdFactory: () => string;

  constructor(options: DataAssetExecutionFrameworkOptions = {}) {
    this.converter = options.converter ?? new DataConverterCore();
    this.previewEngine = options.previewEngine ?? new DataPreviewEngine();
    this.now = options.now ?? (() => new Date());
    this.executionIdFactory = options.executionIdFactory ?? (() => `data-exec-${this.now().getTime()}`);
  }

  public async execute(request: DataAssetExecutionRequest): Promise<DataAssetExecutionResult> {
    const startedAt = nowIso(this.now);
    const operationContext = normalizeDataConverterContext(request.context);
    const executionId = this.executionIdFactory();
    const notes: string[] = [];
    const steps: DataLineageExecutionStep[] = [];
    const inputReferences: DataLineageReference[] = [];
    const outputReferences: DataLineageReference[] = [];
    const validationIssues: DataStudioValidationIssue[] = [];

    const validationStepStartedAt = nowIso(this.now);
    const validationDiagnostics: DataConverterDiagnostic[] = [];
    const requestIssues = validateDataAssetExecutionRequest(request);
    validationIssues.push(...requestIssues);
    validationDiagnostics.push(...toDataConverterDiagnostics(requestIssues));
    if (!request.input && !request.asset.supportsPreview) {
      validationDiagnostics.push(createFailureDiagnostic(
        DataAssetExecutionErrorCodes.previewUnsupported,
        `Data asset '${request.asset.id}' does not support preview-only execution without input.`,
      ));
    }

    steps.push(createDataLineageExecutionStep({
      stepId: "step-validate",
      kind: DataLineageStepKinds.validate,
      status: validationDiagnostics.some((diagnostic) => diagnostic.severity === DataConverterDiagnosticSeverities.error)
        ? DataLineageStepStatuses.failed
        : DataLineageStepStatuses.completed,
      startedAt: validationStepStartedAt,
      completedAt: nowIso(this.now),
      diagnostics: toLineageDiagnostics(validationDiagnostics),
    }));

    if (validationDiagnostics.some((diagnostic) => diagnostic.severity === DataConverterDiagnosticSeverities.error)) {
      const completedAt = nowIso(this.now);
      return this.createFailureResult({
        request,
        executionId,
        operationContext,
        startedAt,
        completedAt,
        diagnostics: Object.freeze(validationDiagnostics),
        message: validationDiagnostics[0].message,
        converterResult: undefined,
        inputReferences,
        outputReferences,
        steps,
        notes,
        validationIssues: Object.freeze(validationIssues),
        failure: createDataStudioFailure({
          kind: DataStudioFailureKinds.validation,
          code: validationDiagnostics[0]?.code ?? DataAssetExecutionErrorCodes.invalidRequest,
          message: validationDiagnostics[0]?.message ?? "Execution validation failed.",
          section: validationIssues[0]?.section ?? "execution-request",
          issues: validationIssues,
          diagnostics: validationDiagnostics,
        }),
      });
    }

    try {
      const resolvedInput = await this.resolveInput(request, operationContext, inputReferences, steps, notes);
      const diagnostics = [...resolvedInput.diagnostics];
      if (resolvedInput.converterResult) {
        const converterResultIssues = validateDataConverterResult(resolvedInput.converterResult);
        validationIssues.push(...converterResultIssues);
        diagnostics.push(...toDataConverterDiagnostics(converterResultIssues));
      }

      const outputShapeIssues = validateCanonicalDataShape(resolvedInput.output);
      validationIssues.push(...outputShapeIssues);
      diagnostics.push(...toDataConverterDiagnostics(outputShapeIssues));
      notes.push(`Output shape summary: ${JSON.stringify(summarizeIssueCountByShapeKind(resolvedInput.output))}`);

      const expectedShapeKind = request.asset.toCanonicalDataShape().kind;
      if (resolvedInput.output.kind !== expectedShapeKind) {
        diagnostics.push(createFailureDiagnostic(
          DataAssetExecutionErrorCodes.outputShapeMismatch,
          `Execution output kind '${resolvedInput.output.kind}' does not match data asset '${request.asset.id}' output kind '${expectedShapeKind}'.`,
        ));
        validationIssues.push(Object.freeze({
          code: DataAssetExecutionErrorCodes.outputShapeMismatch,
          section: "execution-request",
          severity: "error",
          message: `Execution output kind '${resolvedInput.output.kind}' does not match expected kind '${expectedShapeKind}'.`,
          path: "output.kind",
        }));
      }

      if (diagnostics.some((diagnostic) => diagnostic.severity === DataConverterDiagnosticSeverities.error)) {
        const completedAt = nowIso(this.now);
        return this.createFailureResult({
          request,
          executionId,
          operationContext,
          startedAt,
          completedAt,
          diagnostics: Object.freeze(diagnostics),
          message: diagnostics[0]?.message ?? "Data asset execution failed.",
          converterResult: resolvedInput.converterResult,
          inputReferences,
          outputReferences,
          steps,
          notes,
          validationIssues: Object.freeze(validationIssues),
          failure: createDataStudioFailure({
            kind: DataStudioFailureKinds.validation,
            code: diagnostics[0]?.code ?? DataAssetExecutionErrorCodes.executionFailed,
            message: diagnostics[0]?.message ?? "Data asset execution failed validation.",
            section: validationIssues[0]?.section ?? "execution-request",
            issues: validationIssues,
            diagnostics: diagnostics,
          }),
        });
      }

      const previewStepStart = nowIso(this.now);
      const preview = resolvedInput.converterResult
        ? this.previewEngine.buildFromConverterResult(resolvedInput.converterResult, request.previewOptions)
        : this.previewEngine.buildFromCanonicalShape(resolvedInput.output, request.previewOptions, Object.freeze(diagnostics));
      const previewIssues = validateDataPreviewModel(preview);
      validationIssues.push(...previewIssues);
      diagnostics.push(...toDataConverterDiagnostics(previewIssues));
      if (diagnostics.some((diagnostic) => diagnostic.severity === DataConverterDiagnosticSeverities.error)) {
        const completedAt = nowIso(this.now);
        return this.createFailureResult({
          request,
          executionId,
          operationContext,
          startedAt,
          completedAt,
          diagnostics: Object.freeze(diagnostics),
          message: diagnostics[0]?.message ?? "Data preview validation failed.",
          converterResult: resolvedInput.converterResult,
          inputReferences,
          outputReferences,
          steps,
          notes,
          validationIssues: Object.freeze(validationIssues),
          failure: createDataStudioFailure({
            kind: DataStudioFailureKinds.validation,
            code: diagnostics[0]?.code ?? DataAssetExecutionErrorCodes.executionFailed,
            message: diagnostics[0]?.message ?? "Data preview validation failed.",
            section: validationIssues[0]?.section ?? "preview-model",
            issues: validationIssues,
            diagnostics: diagnostics,
          }),
        });
      }
      const previewReference = createDataLineageReference({
        referenceId: "preview-1",
        kind: DataLineageReferenceKinds.preview,
        label: "Preview projection",
        shapeKind: resolvedInput.output.kind,
      });
      outputReferences.push(previewReference);
      steps.push(createDataLineageExecutionStep({
        stepId: "step-preview",
        kind: DataLineageStepKinds.preview,
        status: DataLineageStepStatuses.completed,
        startedAt: previewStepStart,
        completedAt: nowIso(this.now),
        outputReferenceIds: [previewReference.referenceId],
      }));

      const shapeReference = createDataLineageReference({
        referenceId: "output-shape-1",
        kind: DataLineageReferenceKinds.canonicalShape,
        label: "Canonical execution output",
        shapeKind: resolvedInput.output.kind,
      });
      outputReferences.push(shapeReference);

      const packageStepStart = nowIso(this.now);
      steps.push(createDataLineageExecutionStep({
        stepId: "step-package",
        kind: DataLineageStepKinds.packageResult,
        status: DataLineageStepStatuses.completed,
        startedAt: packageStepStart,
        completedAt: nowIso(this.now),
        outputReferenceIds: [shapeReference.referenceId, previewReference.referenceId],
      }));

      const completedAt = nowIso(this.now);
      const lineage = createDataLineageMetadata({
        capturedAt: completedAt,
        producer: {
          assetId: request.asset.id,
          versionId: request.asset.version,
          name: request.asset.name,
        },
        execution: {
          executionId,
          requestId: operationContext.requestId,
          operationId: operationContext.operationId,
          pipelineId: operationContext.pipelineId,
          stageId: operationContext.stageId,
          startedAt,
          completedAt,
        },
        inputs: inputReferences,
        steps,
        outputs: outputReferences,
        diagnostics: toLineageDiagnostics(Object.freeze(diagnostics)),
        notes: Object.freeze(notes),
      });

      return Object.freeze({
        ok: true,
        status: DataAssetExecutionStatuses.succeeded,
        context: Object.freeze({
          executionId,
          requestedBy: normalizeOptional(request.requestedBy),
          startedAt,
          completedAt,
          operationContext,
        }),
        asset: Object.freeze({
          assetId: request.asset.id,
          versionId: request.asset.version,
          name: request.asset.name,
        }),
        output: resolvedInput.output,
        preview,
        diagnostics: Object.freeze(diagnostics),
        validationIssues: Object.freeze(validationIssues),
        converterResult: resolvedInput.converterResult,
        lineage,
      } satisfies DataAssetExecutionResult);
    } catch (error) {
      const completedAt = nowIso(this.now);
      const diagnostic = createFailureDiagnostic(
        DataAssetExecutionErrorCodes.executionFailed,
        error instanceof Error ? error.message : String(error),
      );
      return this.createFailureResult({
        request,
        executionId,
        operationContext,
        startedAt,
        completedAt,
        diagnostics: Object.freeze([diagnostic]),
        message: diagnostic.message,
        converterResult: undefined,
        inputReferences,
        outputReferences,
        steps,
        notes,
        validationIssues: Object.freeze(validationIssues),
        failure: createDataStudioFailure({
          kind: DataStudioFailureKinds.runtime,
          code: diagnostic.code,
          message: diagnostic.message,
          section: "execution-request",
          issues: validationIssues,
          diagnostics: Object.freeze([diagnostic]),
        }),
      });
    }
  }

  private async resolveInput(
    request: DataAssetExecutionRequest,
    operationContext: DataConverterOperationContext,
    inputReferences: DataLineageReference[],
    steps: DataLineageExecutionStep[],
    notes: string[],
  ): Promise<{
    readonly output: CanonicalDataShape;
    readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
    readonly converterResult?: DataConverterResult;
  }> {
    const input = request.input;
    if (!input) {
      notes.push("No execution input provided; using data asset canonical output directly.");
      const output = request.asset.toCanonicalDataShape();
      inputReferences.push(createDataLineageReference({
        referenceId: "input-asset-output",
        kind: DataLineageReferenceKinds.asset,
        assetId: request.asset.id,
        versionId: request.asset.version,
        label: "Data asset canonical output",
        shapeKind: output.kind,
      }));
      steps.push(createDataLineageExecutionStep({
        stepId: "step-convert",
        kind: DataLineageStepKinds.convert,
        status: DataLineageStepStatuses.skipped,
        startedAt: nowIso(this.now),
        completedAt: nowIso(this.now),
        notes: ["Input already canonical on asset."],
      }));
      return Object.freeze({
        output,
        diagnostics: Object.freeze([]),
      });
    }

    if (input.kind === "source-reference") {
      inputReferences.push(createDataLineageReference({
        referenceId: "input-source-reference",
        kind: DataLineageReferenceKinds.sourceReference,
        label: input.source.kind === "in-memory"
          ? "in-memory"
          : input.source.kind === "local-file"
            ? input.source.path
            : input.source.url,
        assetId: input.source.sourceAssetId,
        versionId: input.source.sourceVersionId,
      }));
      const resolveStartedAt = nowIso(this.now);
      const conversion = await this.converter.resolveAndConvertSourceToRecords({
        source: input.source,
        context: operationContext,
        formatHint: input.formatHint,
        delimiter: input.delimiter,
        hasHeaderRow: input.hasHeaderRow,
      });
      steps.push(createDataLineageExecutionStep({
        stepId: "step-resolve-source",
        kind: DataLineageStepKinds.resolveSource,
        status: conversion.ok ? DataLineageStepStatuses.completed : DataLineageStepStatuses.failed,
        startedAt: resolveStartedAt,
        completedAt: nowIso(this.now),
        inputReferenceIds: ["input-source-reference"],
        diagnostics: toLineageDiagnostics(conversion.diagnostics),
      }));
      return this.resolveConverterResult(conversion, inputReferences, steps, notes);
    }

    if (input.kind === "resolved-source") {
      inputReferences.push(createDataLineageReference({
        referenceId: "input-resolved-source",
        kind: DataLineageReferenceKinds.resolvedSource,
        label: input.source.reference,
        assetId: input.source.sourceAssetId,
        versionId: input.source.sourceVersionId,
      }));
      const convertStartedAt = nowIso(this.now);
      const conversion = this.converter.convert({
        operation: DataConverterOperationKinds.sourceToRecords,
        context: operationContext,
        source: input.source,
        formatHint: input.formatHint,
        delimiter: input.delimiter,
        hasHeaderRow: input.hasHeaderRow,
      });
      steps.push(createDataLineageExecutionStep({
        stepId: "step-convert",
        kind: DataLineageStepKinds.convert,
        status: conversion.ok ? DataLineageStepStatuses.completed : DataLineageStepStatuses.failed,
        startedAt: convertStartedAt,
        completedAt: nowIso(this.now),
        inputReferenceIds: ["input-resolved-source"],
        diagnostics: toLineageDiagnostics(conversion.diagnostics),
      }));
      return this.resolveConverterResult(conversion, inputReferences, steps, notes);
    }

    if (input.kind === "converter-request") {
      const convertStartedAt = nowIso(this.now);
      if (input.request.operation === DataConverterOperationKinds.sourceToRecords) {
        inputReferences.push(createDataLineageReference({
          referenceId: "input-converter-resolved-source",
          kind: DataLineageReferenceKinds.resolvedSource,
          label: input.request.source.reference,
          assetId: input.request.source.sourceAssetId,
          versionId: input.request.source.sourceVersionId,
        }));
      } else {
        inputReferences.push(createDataLineageReference({
          referenceId: "input-converter-request",
          kind: DataLineageReferenceKinds.intermediate,
          label: input.request.operation,
        }));
      }

      const conversion = this.converter.convert({
        ...input.request,
        context: operationContext,
      } as DataConverterRequest);
      steps.push(createDataLineageExecutionStep({
        stepId: "step-convert",
        kind: DataLineageStepKinds.convert,
        status: conversion.ok ? DataLineageStepStatuses.completed : DataLineageStepStatuses.failed,
        startedAt: convertStartedAt,
        completedAt: nowIso(this.now),
        diagnostics: toLineageDiagnostics(conversion.diagnostics),
      }));
      return this.resolveConverterResult(conversion, inputReferences, steps, notes);
    }

    if (input.kind === "converter-result") {
      inputReferences.push(createDataLineageReference({
        referenceId: "input-converter-result",
        kind: DataLineageReferenceKinds.intermediate,
        label: "Converter result",
      }));
      steps.push(createDataLineageExecutionStep({
        stepId: "step-convert",
        kind: DataLineageStepKinds.convert,
        status: input.result.ok ? DataLineageStepStatuses.completed : DataLineageStepStatuses.failed,
        startedAt: nowIso(this.now),
        completedAt: nowIso(this.now),
        diagnostics: toLineageDiagnostics(input.result.diagnostics),
      }));
      return this.resolveConverterResult(input.result, inputReferences, steps, notes);
    }

    inputReferences.push(createDataLineageReference({
      referenceId: "input-canonical-shape",
      kind: DataLineageReferenceKinds.canonicalShape,
      shapeKind: input.shape.kind,
      label: "Canonical shape input",
    }));
    steps.push(createDataLineageExecutionStep({
      stepId: "step-convert",
      kind: DataLineageStepKinds.convert,
      status: DataLineageStepStatuses.skipped,
      startedAt: nowIso(this.now),
      completedAt: nowIso(this.now),
      notes: ["Input already provided as canonical shape."],
    }));
    return Object.freeze({
      output: input.shape,
      diagnostics: input.diagnostics ?? Object.freeze([]),
    });
  }

  private resolveConverterResult(
    conversion: DataConverterResult,
    inputReferences: DataLineageReference[],
    steps: DataLineageExecutionStep[],
    notes: string[],
  ): {
    readonly output: CanonicalDataShape;
    readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
    readonly converterResult: DataConverterResult;
  } {
    if (!conversion.ok) {
      return Object.freeze({
        output: {
          kind: "records",
          records: Object.freeze([]),
          metadata: {
            schemaVersion: "1.0.0",
          },
        },
        diagnostics: conversion.diagnostics,
        converterResult: conversion,
      });
    }

    for (const lineageEntry of conversion.metadata.lineage ?? []) {
      inputReferences.push(createDataLineageReference({
        referenceId: `input-lineage-${lineageEntry.assetId}-${lineageEntry.relationship}`,
        kind: DataLineageReferenceKinds.asset,
        assetId: lineageEntry.assetId,
        versionId: lineageEntry.versionId,
        label: lineageEntry.relationship,
      }));
    }
    notes.push(`Converter operation '${conversion.operation}' completed.`);
    const convertStep = steps.find((step) => step.kind === DataLineageStepKinds.convert);
    if (convertStep) {
      steps.splice(steps.indexOf(convertStep), 1, createDataLineageExecutionStep({
        ...convertStep,
        outputReferenceIds: ["output-shape-1"],
      }));
    }

    return Object.freeze({
      output: conversion.output,
      diagnostics: conversion.diagnostics,
      converterResult: conversion,
    });
  }

  private createFailureResult(input: {
    readonly request: DataAssetExecutionRequest;
    readonly executionId: string;
    readonly operationContext: DataConverterOperationContext;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
    readonly message: string;
    readonly converterResult?: DataConverterResult;
    readonly inputReferences: ReadonlyArray<DataLineageReference>;
    readonly outputReferences: ReadonlyArray<DataLineageReference>;
    readonly steps: ReadonlyArray<DataLineageExecutionStep>;
    readonly notes: ReadonlyArray<string>;
    readonly validationIssues: ReadonlyArray<DataStudioValidationIssue>;
    readonly failure: DataStudioFailure;
  }): DataAssetExecutionResult {
    const preview = input.converterResult
      ? this.previewEngine.buildFromConverterResult(input.converterResult)
      : toDataConverterFailurePreview(this.previewEngine, input.message, input.diagnostics);
    const lineage = createDataLineageMetadata({
      capturedAt: input.completedAt,
      producer: {
        assetId: input.request.asset.id,
        versionId: input.request.asset.version,
        name: input.request.asset.name,
      },
      execution: {
        executionId: input.executionId,
        requestId: input.operationContext.requestId,
        operationId: input.operationContext.operationId,
        pipelineId: input.operationContext.pipelineId,
        stageId: input.operationContext.stageId,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
      },
      inputs: input.inputReferences,
      steps: input.steps,
      outputs: input.outputReferences,
      diagnostics: toLineageDiagnostics(input.diagnostics),
      notes: input.notes,
    });

    return Object.freeze({
      ok: false,
      status: DataAssetExecutionStatuses.failed,
      context: Object.freeze({
        executionId: input.executionId,
        requestedBy: normalizeOptional(input.request.requestedBy),
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        operationContext: input.operationContext,
      }),
      asset: Object.freeze({
        assetId: input.request.asset.id,
        versionId: input.request.asset.version,
        name: input.request.asset.name,
      }),
      preview,
      diagnostics: input.diagnostics,
      validationIssues: input.validationIssues,
      failure: input.failure,
      converterResult: input.converterResult,
      lineage,
    } satisfies DataAssetExecutionResult);
  }
}
