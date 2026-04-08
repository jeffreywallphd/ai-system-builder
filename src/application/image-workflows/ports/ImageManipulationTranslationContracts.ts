import { z } from "zod";
import type { ImageWorkflowBackendTranslationReference } from "@domain/image-workflows/ImageWorkflowDomain";

export const ImageManipulationTranslationContractsSchemaVersion = "1.0.0" as const;

export const ImageManipulationTranslationStatuses = Object.freeze({
  succeeded: "succeeded",
  failed: "failed",
});

export type ImageManipulationTranslationStatus =
  typeof ImageManipulationTranslationStatuses[keyof typeof ImageManipulationTranslationStatuses];

export const ImageManipulationTranslationDiagnosticSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export type ImageManipulationTranslationDiagnosticSeverity =
  typeof ImageManipulationTranslationDiagnosticSeverities[keyof typeof ImageManipulationTranslationDiagnosticSeverities];

export const ImageManipulationTranslationDiagnosticCategories = Object.freeze({
  requestValidation: "request-validation",
  templateResolution: "template-resolution",
  slotBinding: "slot-binding",
  parameterMapping: "parameter-mapping",
  outputMapping: "output-mapping",
  capability: "capability",
  payloadAssembly: "payload-assembly",
  internal: "internal",
});

export type ImageManipulationTranslationDiagnosticCategory =
  typeof ImageManipulationTranslationDiagnosticCategories[keyof typeof ImageManipulationTranslationDiagnosticCategories];

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

function looksLikeFilesystemPath(value: string): boolean {
  return value.startsWith("/")
    || value.startsWith("./")
    || value.startsWith("../")
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.includes("\\");
}

const logicalReferenceSchema = z.string().trim().min(1).refine(
  (value) => !looksLikeFilesystemPath(value),
  "Logical reference values cannot be raw filesystem paths.",
);

const translationMetadataSchema = z.record(z.string(), jsonValueSchema);

const workflowBackendTranslationReferenceSchema: z.ZodType<ImageWorkflowBackendTranslationReference> = z.object({
  translatorId: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
  templateVersion: z.string().trim().min(1).optional(),
  inputBindings: z.array(z.object({
    inputId: z.string().trim().min(1),
    backendField: z.string().trim().min(1),
  }).strict()).default([]),
  parameterBindings: z.array(z.object({
    parameterId: z.string().trim().min(1),
    backendField: z.string().trim().min(1),
  }).strict()).default([]),
  outputBindings: z.array(z.object({
    outputId: z.string().trim().min(1),
    backendField: z.string().trim().min(1),
  }).strict()).default([]),
}).strict();

const authoritativeWorkflowReferenceSchema = z.object({
  workflowId: z.string().trim().min(1),
  workflowLineageId: z.string().trim().min(1),
  workflowVersionTag: z.string().trim().min(1),
  workflowRevision: z.number().int().nonnegative(),
  operationKind: z.string().trim().min(1),
  backendTranslation: workflowBackendTranslationReferenceSchema,
}).strict();

const authoritativeSystemReferenceSchema = z.object({
  systemId: z.string().trim().min(1),
  systemVersionId: z.string().trim().min(1).optional(),
  runtimeProfileId: z.string().trim().min(1).optional(),
  workflowBinding: z.object({
    workflowId: z.string().trim().min(1),
    workflowLineageId: z.string().trim().min(1),
    workflowVersionTag: z.string().trim().min(1),
    workflowRevision: z.number().int().nonnegative(),
    requiredInputIds: z.array(z.string().trim().min(1)).default([]),
    requiredParameterIds: z.array(z.string().trim().min(1)).default([]),
    requiredOutputIds: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
  parameterBaseline: z.object({
    values: z.record(z.string(), jsonValueSchema).default({}),
    profileReferences: z.array(logicalReferenceSchema).default([]),
  }).strict(),
}).strict();

const translationTemplateResolutionSchema = z.object({
  translatorId: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
  templateVersion: z.string().trim().min(1).optional(),
  adapterFamily: z.string().trim().min(1).optional(),
  operationTypeKey: z.string().trim().min(1).optional(),
}).strict();

const slotBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  inputId: z.string().trim().min(1),
  backendField: z.string().trim().min(1),
  sourceKind: z.enum(["input-asset", "dataset-instance", "runtime-context", "constant"]).default("input-asset"),
  logicalReference: logicalReferenceSchema,
  role: z.string().trim().min(1).optional(),
  required: z.boolean().default(false),
  metadata: translationMetadataSchema.optional(),
}).strict();

const parameterMappingSchema = z.object({
  parameterId: z.string().trim().min(1),
  backendField: z.string().trim().min(1),
  value: jsonValueSchema,
  valueType: z.string().trim().min(1).optional(),
  source: z.enum(["system-baseline", "runtime-override", "default"]).default("runtime-override"),
  metadata: translationMetadataSchema.optional(),
}).strict();

const outputExpectationSchema = z.object({
  outputId: z.string().trim().min(1),
  backendField: z.string().trim().min(1),
  required: z.boolean().default(false),
  allowsMultiple: z.boolean().default(false),
  logicalTargetReference: logicalReferenceSchema.optional(),
  expectedValueType: z.string().trim().min(1).optional(),
  metadata: translationMetadataSchema.optional(),
}).strict();

const capabilityRequirementsSchema = z.object({
  requiredCapabilities: z.array(z.string().trim().min(1)).default([]),
  preferredBackendFamily: z.string().trim().min(1).optional(),
  minimumAdapterVersion: z.string().trim().min(1).optional(),
  metadata: translationMetadataSchema.optional(),
}).strict().default({
  requiredCapabilities: [],
});

export const ImageManipulationTranslationRequestSchema = z.object({
  contractVersion: z.literal(ImageManipulationTranslationContractsSchemaVersion)
    .default(ImageManipulationTranslationContractsSchemaVersion),
  translationRequestId: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  requestedAt: z.string().trim().min(1),
  requestedByActorId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  authoritative: z.object({
    workflow: authoritativeWorkflowReferenceSchema,
    system: authoritativeSystemReferenceSchema,
  }).strict(),
  templateResolution: translationTemplateResolutionSchema,
  slotBindings: z.array(slotBindingSchema).default([]),
  parameterMappings: z.array(parameterMappingSchema).default([]),
  outputExpectations: z.array(outputExpectationSchema).default([]),
  capabilityRequirements: capabilityRequirementsSchema,
  metadata: translationMetadataSchema.optional(),
}).strict();

export type ImageManipulationTranslationRequest = z.infer<typeof ImageManipulationTranslationRequestSchema>;

const backendExecutionPayloadSchema = z.object({
  payloadVersion: z.string().trim().min(1).default(ImageManipulationTranslationContractsSchemaVersion),
  backendFamily: z.string().trim().min(1),
  operationKind: z.string().trim().min(1),
  template: z.object({
    translatorId: z.string().trim().min(1),
    contractVersion: z.string().trim().min(1),
    templateId: z.string().trim().min(1),
    templateVersion: z.string().trim().min(1).optional(),
  }).strict(),
  requestContext: z.object({
    translationRequestId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    workspaceId: z.string().trim().min(1),
    workflowId: z.string().trim().min(1),
    systemId: z.string().trim().min(1),
    correlationId: z.string().trim().min(1).optional(),
  }).strict(),
  inputs: z.record(z.string(), jsonValueSchema).default({}),
  parameters: z.record(z.string(), jsonValueSchema).default({}),
  outputs: z.array(z.object({
    outputId: z.string().trim().min(1),
    backendField: z.string().trim().min(1),
    required: z.boolean().default(false),
    allowsMultiple: z.boolean().default(false),
    logicalTargetReference: logicalReferenceSchema.optional(),
  }).strict()).default([]),
  requiredCapabilities: z.array(z.string().trim().min(1)).default([]),
  metadata: translationMetadataSchema.optional(),
}).strict();

export type ImageManipulationBackendExecutionPayload = z.infer<typeof backendExecutionPayloadSchema>;

const translationDiagnosticSchema = z.object({
  code: z.string().trim().min(1),
  severity: z.nativeEnum(ImageManipulationTranslationDiagnosticSeverities),
  category: z.nativeEnum(ImageManipulationTranslationDiagnosticCategories),
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
  blocking: z.boolean().default(false),
  details: translationMetadataSchema.optional(),
}).strict();

export type ImageManipulationTranslationDiagnostic = z.infer<typeof translationDiagnosticSchema>;

const translationResultMetadataSchema = z.object({
  translatedAt: z.string().trim().min(1),
  translatorId: z.string().trim().min(1),
  contractVersion: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
  templateVersion: z.string().trim().min(1).optional(),
  backendFamily: z.string().trim().min(1).optional(),
  mappingSummary: z.object({
    slotBindingCount: z.number().int().nonnegative(),
    parameterMappingCount: z.number().int().nonnegative(),
    outputExpectationCount: z.number().int().nonnegative(),
  }).strict(),
  diagnosticsSummary: z.object({
    count: z.number().int().nonnegative(),
    infoCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    blockingCount: z.number().int().nonnegative(),
  }).strict(),
  metadata: translationMetadataSchema.optional(),
}).strict();

const translationSuccessResultSchema = z.object({
  status: z.literal(ImageManipulationTranslationStatuses.succeeded),
  executionPayload: backendExecutionPayloadSchema,
  diagnostics: z.array(translationDiagnosticSchema).default([]),
  metadata: translationResultMetadataSchema,
}).strict();

const translationFailureResultSchema = z.object({
  status: z.literal(ImageManipulationTranslationStatuses.failed),
  diagnostics: z.array(translationDiagnosticSchema).default([]),
  metadata: translationResultMetadataSchema,
}).strict();

export const ImageManipulationTranslationResultSchema = z.discriminatedUnion("status", [
  translationSuccessResultSchema,
  translationFailureResultSchema,
]).superRefine((value, context) => {
  if (value.status === ImageManipulationTranslationStatuses.failed) {
    const hasBlocking = value.diagnostics.some((diagnostic) => diagnostic.blocking || diagnostic.severity === "error");
    if (!hasBlocking) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diagnostics"],
        message: "Failed translation results must include at least one blocking/error diagnostic.",
      });
    }
  }
});

export type ImageManipulationTranslationResult = z.infer<typeof ImageManipulationTranslationResultSchema>;

export const ImageManipulationTranslationRequestEnvelopeSchema = z.object({
  schemaVersion: z.literal(ImageManipulationTranslationContractsSchemaVersion)
    .default(ImageManipulationTranslationContractsSchemaVersion),
  request: ImageManipulationTranslationRequestSchema,
}).strict();

export type ImageManipulationTranslationRequestEnvelope = z.infer<typeof ImageManipulationTranslationRequestEnvelopeSchema>;

export const ImageManipulationTranslationResultEnvelopeSchema = z.object({
  schemaVersion: z.literal(ImageManipulationTranslationContractsSchemaVersion)
    .default(ImageManipulationTranslationContractsSchemaVersion),
  result: ImageManipulationTranslationResultSchema,
}).strict();

export type ImageManipulationTranslationResultEnvelope = z.infer<typeof ImageManipulationTranslationResultEnvelopeSchema>;

export interface IImageManipulationTemplateTranslationPort {
  translateToBackendPayload(
    request: ImageManipulationTranslationRequest,
  ): Promise<ImageManipulationTranslationResult>;
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const candidate = (value as Record<string, unknown>)[key];
    if (candidate && typeof candidate === "object") {
      deepFreeze(candidate);
    }
  }
  return value;
}

function assertUnique(values: ReadonlyArray<string>, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${label} '${value}' must be unique.`);
    }
    seen.add(value);
  }
}

function assertTranslationRequestIntegrity(request: ImageManipulationTranslationRequest): void {
  assertUnique(request.slotBindings.map((entry) => entry.bindingId), "Translation slot bindingId");
  assertUnique(request.parameterMappings.map((entry) => entry.parameterId), "Translation parameterId");
  assertUnique(request.outputExpectations.map((entry) => entry.outputId), "Translation outputId");

  if (request.templateResolution.translatorId !== request.authoritative.workflow.backendTranslation.translatorId) {
    throw new Error("Translation templateResolution.translatorId must match authoritative workflow backendTranslation.translatorId.");
  }
  if (request.templateResolution.templateId !== request.authoritative.workflow.backendTranslation.templateId) {
    throw new Error("Translation templateResolution.templateId must match authoritative workflow backendTranslation.templateId.");
  }
  if (request.templateResolution.contractVersion !== request.authoritative.workflow.backendTranslation.contractVersion) {
    throw new Error("Translation templateResolution.contractVersion must match authoritative workflow backendTranslation.contractVersion.");
  }
}

function assertTranslationResultIntegrity(result: ImageManipulationTranslationResult): void {
  if (result.status !== ImageManipulationTranslationStatuses.succeeded) {
    return;
  }

  if (result.executionPayload.template.translatorId !== result.metadata.translatorId) {
    throw new Error("Translation result metadata.translatorId must match executionPayload.template.translatorId.");
  }
  if (result.executionPayload.template.templateId !== result.metadata.templateId) {
    throw new Error("Translation result metadata.templateId must match executionPayload.template.templateId.");
  }
  if (result.executionPayload.template.contractVersion !== result.metadata.contractVersion) {
    throw new Error("Translation result metadata.contractVersion must match executionPayload.template.contractVersion.");
  }
}

export function validateImageManipulationTranslationRequest(input: unknown): ImageManipulationTranslationRequest {
  const parsed = ImageManipulationTranslationRequestSchema.parse(input);
  assertTranslationRequestIntegrity(parsed);
  return deepFreeze(parsed);
}

export function validateImageManipulationTranslationResult(input: unknown): ImageManipulationTranslationResult {
  const parsed = ImageManipulationTranslationResultSchema.parse(input);
  assertTranslationResultIntegrity(parsed);
  return deepFreeze(parsed);
}

export function serializeImageManipulationTranslationRequestEnvelope(
  request: ImageManipulationTranslationRequest,
): ImageManipulationTranslationRequestEnvelope {
  return deepFreeze({
    schemaVersion: ImageManipulationTranslationContractsSchemaVersion,
    request: validateImageManipulationTranslationRequest(request),
  });
}

export function serializeImageManipulationTranslationResultEnvelope(
  result: ImageManipulationTranslationResult,
): ImageManipulationTranslationResultEnvelope {
  return deepFreeze({
    schemaVersion: ImageManipulationTranslationContractsSchemaVersion,
    result: validateImageManipulationTranslationResult(result),
  });
}

export function parseImageManipulationTranslationRequestEnvelope(
  input: unknown,
): ImageManipulationTranslationRequestEnvelope | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const schemaVersion = (input as { readonly schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== ImageManipulationTranslationContractsSchemaVersion) {
    throw new Error(`unsupported-image-manipulation-translation-request-schema-version:${String(schemaVersion)}`);
  }
  const parsed = ImageManipulationTranslationRequestEnvelopeSchema.parse(input);
  return serializeImageManipulationTranslationRequestEnvelope(parsed.request);
}

export function parseImageManipulationTranslationResultEnvelope(
  input: unknown,
): ImageManipulationTranslationResultEnvelope | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const schemaVersion = (input as { readonly schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== ImageManipulationTranslationContractsSchemaVersion) {
    throw new Error(`unsupported-image-manipulation-translation-result-schema-version:${String(schemaVersion)}`);
  }
  const parsed = ImageManipulationTranslationResultEnvelopeSchema.parse(input);
  return serializeImageManipulationTranslationResultEnvelope(parsed.result);
}
