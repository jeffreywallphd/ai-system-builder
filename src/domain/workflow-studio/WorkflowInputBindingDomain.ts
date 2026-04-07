import { z } from "zod";
import type { WorkflowDraftInputValueType } from "./WorkflowStudioDomain";

export const WorkflowInputBindingContractVersion = "1.1.0";

export const WorkflowInputBindingSourceKinds = Object.freeze({
  uiFormValue: "ui-form-value",
  runtimeParameter: "runtime-parameter",
  triggerPayload: "trigger-payload",
  selectedImage: "selected-image",
  datasetInstanceReference: "dataset-instance-reference",
  constantValue: "constant-value",
});

export type WorkflowInputBindingSourceKind =
  typeof WorkflowInputBindingSourceKinds[keyof typeof WorkflowInputBindingSourceKinds];

const bindingSourceBaseSchema = z.object({
  sourceId: z.string().trim().min(1),
  priority: z.number().int().min(1).default(100),
  required: z.boolean().default(false),
  description: z.string().trim().min(1).optional(),
});

const datasetResolutionSchema = z.object({
  shape: z.enum(["instance", "record", "collection"]).default("instance"),
  recordId: z.string().trim().min(1).optional(),
  index: z.number().int().min(0).optional(),
  fieldPath: z.string().trim().min(1).optional(),
});

const datasetInstanceRefSchema = z.object({
  systemId: z.string().trim().min(1).optional(),
  instanceId: z.string().trim().min(1),
  datasetAssetId: z.string().trim().min(1).optional(),
  datasetVersionId: z.string().trim().min(1).optional(),
  purpose: z.string().trim().min(1).optional(),
});

const uiFormValueSourceSchema = bindingSourceBaseSchema.extend({
  kind: z.literal(WorkflowInputBindingSourceKinds.uiFormValue),
  formKey: z.string().trim().min(1),
});

const runtimeParameterSourceSchema = bindingSourceBaseSchema.extend({
  kind: z.literal(WorkflowInputBindingSourceKinds.runtimeParameter),
  parameterKey: z.string().trim().min(1),
});

const triggerPayloadSourceSchema = bindingSourceBaseSchema.extend({
  kind: z.literal(WorkflowInputBindingSourceKinds.triggerPayload),
  payloadKey: z.string().trim().min(1),
});

const selectedImageSourceSchema = bindingSourceBaseSchema.extend({
  kind: z.literal(WorkflowInputBindingSourceKinds.selectedImage),
  path: z.string().trim().min(1).optional(),
});

const datasetInstanceSourceSchema = bindingSourceBaseSchema.extend({
  kind: z.literal(WorkflowInputBindingSourceKinds.datasetInstanceReference),
  systemId: z.string().trim().min(1).optional(),
  instanceId: z.string().trim().min(1).optional(),
  datasetAssetId: z.string().trim().min(1).optional(),
  datasetVersionId: z.string().trim().min(1).optional(),
  purpose: z.string().trim().min(1).optional(),
  resolution: datasetResolutionSchema.optional(),
});

const constantValueSourceSchema = bindingSourceBaseSchema.extend({
  kind: z.literal(WorkflowInputBindingSourceKinds.constantValue),
  value: z.unknown(),
});

export const WorkflowInputBindingSourceSchema = z.discriminatedUnion("kind", [
  uiFormValueSourceSchema,
  runtimeParameterSourceSchema,
  triggerPayloadSourceSchema,
  selectedImageSourceSchema,
  datasetInstanceSourceSchema,
  constantValueSourceSchema,
]);

export type WorkflowInputBindingSourceDescriptor = z.infer<typeof WorkflowInputBindingSourceSchema>;

export const WorkflowInputBindingDescriptorSchema = z.object({
  bindingId: z.string().trim().min(1),
  inputId: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1).default(WorkflowInputBindingContractVersion),
  required: z.boolean().default(false),
  valueType: z.string().trim().min(1).optional(),
  defaultValue: z.unknown().optional(),
  sources: z.array(WorkflowInputBindingSourceSchema).min(1),
});

export interface WorkflowInputBindingDescriptor extends Omit<z.infer<typeof WorkflowInputBindingDescriptorSchema>, "valueType"> {
  readonly valueType?: WorkflowDraftInputValueType | (string & {});
}

export const WorkflowInputBindingResolutionDiagnosticCodes = Object.freeze({
  unresolvedRequiredInput: "unresolved-required-input",
  unresolvedOptionalInput: "unresolved-optional-input",
  sourceValueMissing: "source-value-missing",
  missingFieldReference: "missing-field-reference",
  invalidSelectionReference: "invalid-selection-reference",
  selectedImageMissing: "selected-image-missing",
  datasetInstanceMissing: "dataset-instance-missing",
  datasetRecordMissing: "dataset-record-missing",
  datasetResolutionShapeUnsupported: "dataset-resolution-shape-unsupported",
  datasetSchemaIncompatible: "dataset-schema-incompatible",
  typeMismatch: "type-mismatch",
  invalidBindingConfiguration: "invalid-binding-configuration",
  invalidSourceReference: "invalid-source-reference",
  missingRequiredContext: "missing-required-context",
  ambiguousBindingConfiguration: "ambiguous-binding-configuration",
});

export type WorkflowInputBindingResolutionDiagnosticCode =
  typeof WorkflowInputBindingResolutionDiagnosticCodes[keyof typeof WorkflowInputBindingResolutionDiagnosticCodes];

export interface WorkflowInputBindingResolutionDiagnostic {
  readonly code: WorkflowInputBindingResolutionDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly inputId: string;
  readonly bindingId: string;
  readonly sourceId?: string;
  readonly sourceKind?: WorkflowInputBindingSourceKind;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowInputBindingPreviewMetadata {
  readonly selectedSourceId?: string;
  readonly selectedSourceKind?: WorkflowInputBindingSourceKind;
  readonly selectedPriority?: number;
  readonly candidateSourceIds: ReadonlyArray<string>;
}

export interface WorkflowInputBindingResolutionRecord {
  readonly inputId: string;
  readonly bindingId: string;
  readonly required: boolean;
  readonly valueType?: WorkflowDraftInputValueType | (string & {});
  readonly resolved: boolean;
  readonly value?: unknown;
  readonly resolutionKind?: "source" | "default";
  readonly sourceId?: string;
  readonly sourceKind?: WorkflowInputBindingSourceKind;
  readonly preview: WorkflowInputBindingPreviewMetadata;
}

export interface WorkflowInputBindingResolutionResult {
  readonly contractVersion: string;
  readonly resolvedValues: Readonly<Record<string, unknown>>;
  readonly records: ReadonlyArray<WorkflowInputBindingResolutionRecord>;
  readonly diagnostics: ReadonlyArray<WorkflowInputBindingResolutionDiagnostic>;
}

export interface WorkflowInputBindingResolutionContext {
  readonly uiFormValues?: Readonly<Record<string, unknown>>;
  readonly runtimeParameters?: Readonly<Record<string, unknown>>;
  readonly triggerPayload?: Readonly<Record<string, unknown>>;
  readonly selectedImage?: Readonly<Record<string, unknown>>;
  readonly datasetInstances?: ReadonlyArray<{
    readonly systemId?: string;
    readonly instanceId: string;
    readonly datasetAssetId?: string;
    readonly datasetVersionId?: string;
    readonly purpose?: string;
    readonly schema?: Readonly<{
      readonly recordValueType?: WorkflowDraftInputValueType | (string & {});
      readonly collectionValueType?: WorkflowDraftInputValueType | (string & {});
    }>;
    readonly records?: ReadonlyArray<{
      readonly recordId: string;
      readonly value: unknown;
    }>;
  }>;
}

export function createWorkflowInputBindingDescriptor(input: unknown): WorkflowInputBindingDescriptor {
  const parsed = WorkflowInputBindingDescriptorSchema.parse(input);
  const sortedSources = [...parsed.sources].sort((a, b) => a.priority - b.priority);
  return Object.freeze({
    ...parsed,
    sources: Object.freeze(sortedSources.map((source) => Object.freeze({ ...source }))),
  });
}

export function createDatasetInstanceReference(input: unknown): z.infer<typeof datasetInstanceRefSchema> {
  return Object.freeze(datasetInstanceRefSchema.parse(input));
}

export function validateWorkflowInputBindingDefinitions(input: {
  readonly bindings: ReadonlyArray<WorkflowInputBindingDescriptor>;
}): ReadonlyArray<WorkflowInputBindingResolutionDiagnostic> {
  const diagnostics: WorkflowInputBindingResolutionDiagnostic[] = [];
  const seenInputIds = new Set<string>();

  for (const binding of input.bindings) {
    if (seenInputIds.has(binding.inputId)) {
      diagnostics.push(Object.freeze({
        code: WorkflowInputBindingResolutionDiagnosticCodes.ambiguousBindingConfiguration,
        severity: "error",
        inputId: binding.inputId,
        bindingId: binding.bindingId,
        message: `Input '${binding.inputId}' is bound by more than one binding descriptor.`,
        path: `workflow.inputBindings.${binding.bindingId}`,
      }));
    }
    seenInputIds.add(binding.inputId);

    for (const source of binding.sources) {
      if (source.kind === WorkflowInputBindingSourceKinds.datasetInstanceReference) {
        if (!source.instanceId && !source.purpose) {
          diagnostics.push(Object.freeze({
            code: WorkflowInputBindingResolutionDiagnosticCodes.invalidBindingConfiguration,
            severity: "error",
            inputId: binding.inputId,
            bindingId: binding.bindingId,
            sourceId: source.sourceId,
            sourceKind: source.kind,
            message: "Dataset-instance binding requires either instanceId or purpose.",
            path: `workflow.inputBindings.${binding.bindingId}`,
          }));
        }
        if (source.resolution?.shape === "record" && !source.resolution.recordId && source.resolution.index === undefined) {
          diagnostics.push(Object.freeze({
            code: WorkflowInputBindingResolutionDiagnosticCodes.invalidBindingConfiguration,
            severity: "error",
            inputId: binding.inputId,
            bindingId: binding.bindingId,
            sourceId: source.sourceId,
            sourceKind: source.kind,
            message: "Dataset record resolution requires recordId or index.",
            path: `workflow.inputBindings.${binding.bindingId}`,
          }));
        }
      }
    }
  }

  return Object.freeze(diagnostics);
}
