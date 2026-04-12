import { z } from "zod";
import {
  ImageWorkflowBindingContractError,
  createImageSystemBindingContract,
  createImageWorkflowBindingContract,
} from "@shared/contracts/image-workflows/ImageWorkflowBindingContracts";
import {
  ImageWorkflowParameterContractError,
  ImageSystemParameterValueSources,
} from "@shared/contracts/image-workflows/ImageWorkflowParameterContracts";
import {
  ImageWorkflowApiReadinessStates,
  ImageWorkflowActivationStatuses,
  ImageWorkflowApiSurfaceTargets,
  ImageWorkflowApiValidationSeverities,
  ImageWorkflowLifecycleStates,
  ImageWorkflowSystemApiContractVersions,
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  type CreateImageSystemRequestDto,
  type CreateImageSystemResponseDto,
  type CreateImageWorkflowRequestDto,
  type CreateImageWorkflowResponseDto,
  type GetImageSystemRequestDto,
  type GetImageSystemResponseDto,
  type GetImageWorkflowRequestDto,
  type GetImageWorkflowResponseDto,
  type ListImageSystemsRequestDto,
  type ListImageSystemsResponseDto,
  type ListImageWorkflowsRequestDto,
  type ListImageWorkflowsResponseDto,
  type UpdateImageSystemRequestDto,
  type UpdateImageSystemResponseDto,
  type UpdateImageWorkflowRequestDto,
  type UpdateImageWorkflowResponseDto,
  type ValidateImageSystemRequestDto,
  type ValidateImageSystemResponseDto,
  type ValidateImageWorkflowRequestDto,
  type ValidateImageWorkflowResponseDto,
} from "@shared/contracts/image-workflows/ImageWorkflowSystemApiContracts";
import {
  ImageWorkflowParameterSpecificationError,
  normalizeImageWorkflowParameterSpecification,
  type ImageWorkflowParameterSpecification,
} from "@domain/image-workflows/ImageWorkflowParameterSpecification";

export interface ImageWorkflowSystemApiSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class ImageWorkflowSystemApiSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<ImageWorkflowSystemApiSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<ImageWorkflowSystemApiSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "ImageWorkflowSystemApiSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const ShortTextSchema = z.string().trim().min(1).max(512);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const OptionalTextSchema = z.string().trim().min(1).max(2000).optional();
const TagSchema = z.string().trim().min(1).max(64);
const VersionTagSchema = z.string().trim().regex(/^\d+\.\d+\.\d+$/, "versionTag must be semver '<major>.<minor>.<patch>'.");

function isFilesystemLikeLogicalReference(value: string): boolean {
  return /^[a-zA-Z]:\\/.test(value) || value.startsWith("/") || value.includes("\\");
}

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): ImageWorkflowSystemApiSchemaValidationError {
  return new ImageWorkflowSystemApiSchemaValidationError(
    schemaName,
    error.issues.map((issue) => ({
      path: formatZodPath(issue.path),
      message: issue.message,
      code: issue.code,
    })),
  );
}

function parseSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

const ParameterSpecificationSchema = z.unknown().transform((value, context): ImageWorkflowParameterSpecification => {
  try {
    return normalizeImageWorkflowParameterSpecification(value as ImageWorkflowParameterSpecification);
  } catch (error) {
    if (error instanceof ImageWorkflowParameterSpecificationError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error.message,
      });
      return z.NEVER;
    }
    throw error;
  }
});

const InputSlotSchema = z.object({
  slotId: IdentifierSchema,
  label: ShortTextSchema,
  description: OptionalTextSchema,
  purpose: ShortTextSchema,
  required: z.boolean(),
  cardinality: z.enum(["one", "many"]),
  minimumAssetCount: z.number().int().min(0),
  maximumAssetCount: z.number().int().positive().optional(),
  allowedAssetClasses: z.array(IdentifierSchema),
  allowedMediaClasses: z.array(IdentifierSchema),
}).strict();

const OutputSlotSchema = z.object({
  slotId: IdentifierSchema,
  label: ShortTextSchema,
  description: OptionalTextSchema,
  purpose: ShortTextSchema,
  required: z.boolean(),
  cardinality: z.enum(["one", "many"]),
  minimumAssetCount: z.number().int().min(0),
  maximumAssetCount: z.number().int().positive().optional(),
  emittedAssetClasses: z.array(IdentifierSchema),
  emittedMediaClasses: z.array(IdentifierSchema),
}).strict();

const ApiVersionMetadataSchema = z.object({
  lineageId: IdentifierSchema,
  versionTag: VersionTagSchema,
  revision: z.number().int().min(0),
  supersedesWorkflowId: IdentifierSchema.optional(),
}).strict();

const CompatibilityMetadataSchema = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  supportedClients: z.array(z.enum([
    ImageWorkflowApiSurfaceTargets.desktop,
    ImageWorkflowApiSurfaceTargets.thinClient,
  ])).min(1),
  executionAdapterId: IdentifierSchema,
  executionAdapterVersion: ShortTextSchema,
  minimumApiVersion: OptionalTextSchema,
}).strict();

const ValidationIssueSchema = z.object({
  code: IdentifierSchema,
  path: IdentifierSchema,
  message: ShortTextSchema,
  severity: z.enum([
    ImageWorkflowApiValidationSeverities.error,
    ImageWorkflowApiValidationSeverities.warning,
    ImageWorkflowApiValidationSeverities.info,
  ]),
}).strict();

const ValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(ValidationIssueSchema),
}).strict();

const ReadinessSchema = z.object({
  state: z.enum([
    ImageWorkflowApiReadinessStates.definitionIncomplete,
    ImageWorkflowApiReadinessStates.definitionReady,
    ImageWorkflowApiReadinessStates.configurationIncomplete,
    ImageWorkflowApiReadinessStates.configurationReady,
    ImageWorkflowApiReadinessStates.configurationRunnable,
  ]),
  ready: z.boolean(),
  checkedAt: TimestampSchema,
}).strict();

const WorkflowDefinitionSchema = z.object({
  workflowId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  title: ShortTextSchema,
  summary: OptionalTextSchema,
  tags: z.array(TagSchema),
  operationKind: IdentifierSchema,
  lifecycleState: z.enum([
    ImageWorkflowLifecycleStates.draft,
    ImageWorkflowLifecycleStates.review,
    ImageWorkflowLifecycleStates.published,
    ImageWorkflowLifecycleStates.deprecated,
    ImageWorkflowLifecycleStates.retired,
  ]),
  activationStatus: z.enum([
    ImageWorkflowActivationStatuses.active,
    ImageWorkflowActivationStatuses.inactive,
  ]),
  version: ApiVersionMetadataSchema,
  compatibility: CompatibilityMetadataSchema,
  inputSlots: z.array(InputSlotSchema),
  outputSlots: z.array(OutputSlotSchema),
  parameterSpecifications: z.array(ParameterSpecificationSchema),
  createdBy: IdentifierSchema,
  lastModifiedBy: IdentifierSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  try {
    createImageWorkflowBindingContract({
      workflowId: value.workflowId,
      workflowVersionTag: value.version.versionTag,
      inputSlots: value.inputSlots,
      outputSlots: value.outputSlots,
    });
  } catch (error) {
    if (error instanceof ImageWorkflowBindingContractError || error instanceof ImageWorkflowParameterContractError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputSlots"],
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

const SystemInputBindingSchema = z.object({
  bindingId: IdentifierSchema,
  slotId: IdentifierSchema,
  assets: z.array(z.object({
    assetReferenceId: IdentifierSchema,
    assetClass: IdentifierSchema,
    mediaClass: IdentifierSchema.optional(),
  }).strict()),
}).strict().superRefine((value, context) => {
  for (const asset of value.assets) {
    if (isFilesystemLikeLogicalReference(asset.assetReferenceId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assets"],
        message: "assetReferenceId must be a logical reference and cannot be a filesystem path.",
      });
      break;
    }
  }
});

const SystemOutputBindingSchema = z.object({
  bindingId: IdentifierSchema,
  slotId: IdentifierSchema,
  targetReference: IdentifierSchema,
  acceptedAssetClasses: z.array(IdentifierSchema),
  acceptedMediaClasses: z.array(IdentifierSchema),
}).strict().superRefine((value, context) => {
  if (isFilesystemLikeLogicalReference(value.targetReference)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetReference"],
      message: "targetReference must be a logical reference and cannot be a filesystem path.",
    });
  }
});

const SystemParameterValueSchema = z.object({
  parameterId: IdentifierSchema,
  value: z.unknown(),
  source: z.enum([
    ImageSystemParameterValueSources.baseline,
    ImageSystemParameterValueSources.profile,
    ImageSystemParameterValueSources.runtimeOverride,
  ]),
}).strict();

const SystemLineageSchema = z.object({
  latestRunId: IdentifierSchema.optional(),
  latestRunOccurredAt: TimestampSchema.optional(),
  latestOutputAssetIds: z.array(IdentifierSchema),
}).strict();

const SystemWorkflowBindingSchema = z.object({
  workflowId: IdentifierSchema,
  workflowVersionTag: VersionTagSchema,
  workflowRevision: z.number().int().min(0),
  workflowLineageId: IdentifierSchema,
}).strict();

const SystemDefinitionSchema = z.object({
  systemId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  title: ShortTextSchema,
  summary: OptionalTextSchema,
  tags: z.array(TagSchema),
  lifecycleState: z.enum([
    ImageSystemLifecycleStates.draft,
    ImageSystemLifecycleStates.ready,
    ImageSystemLifecycleStates.archived,
  ]),
  runtimeStatus: z.enum([
    ImageSystemRuntimeStatuses.enabled,
    ImageSystemRuntimeStatuses.disabled,
  ]),
  workflowBinding: SystemWorkflowBindingSchema,
  inputBindings: z.array(SystemInputBindingSchema),
  outputBindings: z.array(SystemOutputBindingSchema),
  parameterValues: z.array(SystemParameterValueSchema),
  lineage: SystemLineageSchema,
  compatibility: CompatibilityMetadataSchema,
  createdBy: IdentifierSchema,
  lastModifiedBy: IdentifierSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  try {
    createImageSystemBindingContract({
      systemId: value.systemId,
      workflowId: value.workflowBinding.workflowId,
      inputBindings: value.inputBindings,
      outputBindings: value.outputBindings,
    });
  } catch (error) {
    if (error instanceof ImageWorkflowBindingContractError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputBindings"],
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

const WorkflowSummarySchema = z.object({
  workflowId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  title: ShortTextSchema,
  summary: OptionalTextSchema,
  operationKind: IdentifierSchema,
  lifecycleState: z.enum([
    ImageWorkflowLifecycleStates.draft,
    ImageWorkflowLifecycleStates.review,
    ImageWorkflowLifecycleStates.published,
    ImageWorkflowLifecycleStates.deprecated,
    ImageWorkflowLifecycleStates.retired,
  ]),
  activationStatus: z.enum([
    ImageWorkflowActivationStatuses.active,
    ImageWorkflowActivationStatuses.inactive,
  ]),
  version: ApiVersionMetadataSchema,
  readiness: ReadinessSchema,
  updatedAt: TimestampSchema,
}).strict();

const SystemSummarySchema = z.object({
  systemId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  title: ShortTextSchema,
  summary: OptionalTextSchema,
  lifecycleState: z.enum([
    ImageSystemLifecycleStates.draft,
    ImageSystemLifecycleStates.ready,
    ImageSystemLifecycleStates.archived,
  ]),
  runtimeStatus: z.enum([
    ImageSystemRuntimeStatuses.enabled,
    ImageSystemRuntimeStatuses.disabled,
  ]),
  workflowBinding: SystemWorkflowBindingSchema,
  readiness: ReadinessSchema,
  updatedAt: TimestampSchema,
}).strict();

const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(500),
  offset: z.number().int().min(0),
  returned: z.number().int().min(0),
  hasMore: z.boolean(),
}).strict();

function assertNoForbiddenInternalKeys(value: unknown, context: z.RefinementCtx): void {
  const forbidden = new Set(["rawGraph", "graphJson", "comfyPromptGraph", "filesystemPath", "absolutePath", "localPath"]);

  const visit = (node: unknown, path: ReadonlyArray<string | number>): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, [...path, index]));
      return;
    }
    for (const [key, entry] of Object.entries(node)) {
      if (forbidden.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, key],
          message: `Field '${key}' is not allowed in shared image workflow/system API contracts.`,
        });
      }
      visit(entry, [...path, key]);
    }
  };

  visit(value, []);
}

export const CreateImageWorkflowRequestDtoSchema: z.ZodType<CreateImageWorkflowRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  operationKey: IdentifierSchema.optional(),
  workflow: WorkflowDefinitionSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const CreateImageWorkflowResponseDtoSchema: z.ZodType<CreateImageWorkflowResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workflow: WorkflowDefinitionSchema,
  readiness: ReadinessSchema,
  validation: ValidationResultSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const UpdateImageWorkflowRequestDtoSchema: z.ZodType<UpdateImageWorkflowRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  workflowId: IdentifierSchema,
  expectedRevision: z.number().int().min(0).optional(),
  workflow: WorkflowDefinitionSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const UpdateImageWorkflowResponseDtoSchema: z.ZodType<UpdateImageWorkflowResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workflow: WorkflowDefinitionSchema,
  readiness: ReadinessSchema,
  validation: ValidationResultSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetImageWorkflowRequestDtoSchema: z.ZodType<GetImageWorkflowRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  workflowId: IdentifierSchema,
}).strict();

export const GetImageWorkflowResponseDtoSchema: z.ZodType<GetImageWorkflowResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workflow: WorkflowDefinitionSchema,
  readiness: ReadinessSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const ListImageWorkflowsRequestDtoSchema: z.ZodType<ListImageWorkflowsRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  lifecycleStates: z.array(z.enum([
    ImageWorkflowLifecycleStates.draft,
    ImageWorkflowLifecycleStates.review,
    ImageWorkflowLifecycleStates.published,
    ImageWorkflowLifecycleStates.deprecated,
    ImageWorkflowLifecycleStates.retired,
  ])).optional(),
  activationStatuses: z.array(z.enum([
    ImageWorkflowActivationStatuses.active,
    ImageWorkflowActivationStatuses.inactive,
  ])).optional(),
  operationKinds: z.array(IdentifierSchema).optional(),
  tags: z.array(TagSchema).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const ListImageWorkflowsResponseDtoSchema: z.ZodType<ListImageWorkflowsResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  items: z.array(WorkflowSummarySchema),
  pagination: PaginationSchema,
}).strict();

export const ValidateImageWorkflowRequestDtoSchema: z.ZodType<ValidateImageWorkflowRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  workflowId: IdentifierSchema,
}).strict();

export const ValidateImageWorkflowResponseDtoSchema: z.ZodType<ValidateImageWorkflowResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  readiness: ReadinessSchema,
  validation: ValidationResultSchema,
}).strict();

export const CreateImageSystemRequestDtoSchema: z.ZodType<CreateImageSystemRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  operationKey: IdentifierSchema.optional(),
  system: SystemDefinitionSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const CreateImageSystemResponseDtoSchema: z.ZodType<CreateImageSystemResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  system: SystemDefinitionSchema,
  readiness: ReadinessSchema,
  validation: ValidationResultSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const UpdateImageSystemRequestDtoSchema: z.ZodType<UpdateImageSystemRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema,
  expectedRevision: z.number().int().min(0).optional(),
  system: SystemDefinitionSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const UpdateImageSystemResponseDtoSchema: z.ZodType<UpdateImageSystemResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  system: SystemDefinitionSchema,
  readiness: ReadinessSchema,
  validation: ValidationResultSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetImageSystemRequestDtoSchema: z.ZodType<GetImageSystemRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema,
}).strict();

export const GetImageSystemResponseDtoSchema: z.ZodType<GetImageSystemResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  system: SystemDefinitionSchema,
  readiness: ReadinessSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const ListImageSystemsRequestDtoSchema: z.ZodType<ListImageSystemsRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  workflowId: IdentifierSchema.optional(),
  lifecycleStates: z.array(z.enum([
    ImageSystemLifecycleStates.draft,
    ImageSystemLifecycleStates.ready,
    ImageSystemLifecycleStates.archived,
  ])).optional(),
  runtimeStatuses: z.array(z.enum([
    ImageSystemRuntimeStatuses.enabled,
    ImageSystemRuntimeStatuses.disabled,
  ])).optional(),
  tags: z.array(TagSchema).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const ListImageSystemsResponseDtoSchema: z.ZodType<ListImageSystemsResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  items: z.array(SystemSummarySchema),
  pagination: PaginationSchema,
}).strict();

export const ValidateImageSystemRequestDtoSchema: z.ZodType<ValidateImageSystemRequestDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema,
}).strict();

export const ValidateImageSystemResponseDtoSchema: z.ZodType<ValidateImageSystemResponseDto> = z.object({
  contractVersion: z.literal(ImageWorkflowSystemApiContractVersions.v1),
  readiness: ReadinessSchema,
  validation: ValidationResultSchema,
}).strict();

export type CreateImageWorkflowRequestDtoPayload = z.infer<typeof CreateImageWorkflowRequestDtoSchema>;
export type CreateImageWorkflowResponseDtoPayload = z.infer<typeof CreateImageWorkflowResponseDtoSchema>;
export type UpdateImageWorkflowRequestDtoPayload = z.infer<typeof UpdateImageWorkflowRequestDtoSchema>;
export type UpdateImageWorkflowResponseDtoPayload = z.infer<typeof UpdateImageWorkflowResponseDtoSchema>;
export type GetImageWorkflowRequestDtoPayload = z.infer<typeof GetImageWorkflowRequestDtoSchema>;
export type GetImageWorkflowResponseDtoPayload = z.infer<typeof GetImageWorkflowResponseDtoSchema>;
export type ListImageWorkflowsRequestDtoPayload = z.infer<typeof ListImageWorkflowsRequestDtoSchema>;
export type ListImageWorkflowsResponseDtoPayload = z.infer<typeof ListImageWorkflowsResponseDtoSchema>;
export type ValidateImageWorkflowRequestDtoPayload = z.infer<typeof ValidateImageWorkflowRequestDtoSchema>;
export type ValidateImageWorkflowResponseDtoPayload = z.infer<typeof ValidateImageWorkflowResponseDtoSchema>;

export type CreateImageSystemRequestDtoPayload = z.infer<typeof CreateImageSystemRequestDtoSchema>;
export type CreateImageSystemResponseDtoPayload = z.infer<typeof CreateImageSystemResponseDtoSchema>;
export type UpdateImageSystemRequestDtoPayload = z.infer<typeof UpdateImageSystemRequestDtoSchema>;
export type UpdateImageSystemResponseDtoPayload = z.infer<typeof UpdateImageSystemResponseDtoSchema>;
export type GetImageSystemRequestDtoPayload = z.infer<typeof GetImageSystemRequestDtoSchema>;
export type GetImageSystemResponseDtoPayload = z.infer<typeof GetImageSystemResponseDtoSchema>;
export type ListImageSystemsRequestDtoPayload = z.infer<typeof ListImageSystemsRequestDtoSchema>;
export type ListImageSystemsResponseDtoPayload = z.infer<typeof ListImageSystemsResponseDtoSchema>;
export type ValidateImageSystemRequestDtoPayload = z.infer<typeof ValidateImageSystemRequestDtoSchema>;
export type ValidateImageSystemResponseDtoPayload = z.infer<typeof ValidateImageSystemResponseDtoSchema>;

export function parseCreateImageWorkflowRequestDto(payload: unknown): CreateImageWorkflowRequestDtoPayload {
  return parseSchema("CreateImageWorkflowRequestDto", CreateImageWorkflowRequestDtoSchema, payload);
}

export function parseCreateImageWorkflowResponseDto(payload: unknown): CreateImageWorkflowResponseDtoPayload {
  return parseSchema("CreateImageWorkflowResponseDto", CreateImageWorkflowResponseDtoSchema, payload);
}

export function parseUpdateImageWorkflowRequestDto(payload: unknown): UpdateImageWorkflowRequestDtoPayload {
  return parseSchema("UpdateImageWorkflowRequestDto", UpdateImageWorkflowRequestDtoSchema, payload);
}

export function parseUpdateImageWorkflowResponseDto(payload: unknown): UpdateImageWorkflowResponseDtoPayload {
  return parseSchema("UpdateImageWorkflowResponseDto", UpdateImageWorkflowResponseDtoSchema, payload);
}

export function parseGetImageWorkflowRequestDto(payload: unknown): GetImageWorkflowRequestDtoPayload {
  return parseSchema("GetImageWorkflowRequestDto", GetImageWorkflowRequestDtoSchema, payload);
}

export function parseGetImageWorkflowResponseDto(payload: unknown): GetImageWorkflowResponseDtoPayload {
  return parseSchema("GetImageWorkflowResponseDto", GetImageWorkflowResponseDtoSchema, payload);
}

export function parseListImageWorkflowsRequestDto(payload: unknown): ListImageWorkflowsRequestDtoPayload {
  return parseSchema("ListImageWorkflowsRequestDto", ListImageWorkflowsRequestDtoSchema, payload);
}

export function parseListImageWorkflowsResponseDto(payload: unknown): ListImageWorkflowsResponseDtoPayload {
  return parseSchema("ListImageWorkflowsResponseDto", ListImageWorkflowsResponseDtoSchema, payload);
}

export function parseValidateImageWorkflowRequestDto(payload: unknown): ValidateImageWorkflowRequestDtoPayload {
  return parseSchema("ValidateImageWorkflowRequestDto", ValidateImageWorkflowRequestDtoSchema, payload);
}

export function parseValidateImageWorkflowResponseDto(payload: unknown): ValidateImageWorkflowResponseDtoPayload {
  return parseSchema("ValidateImageWorkflowResponseDto", ValidateImageWorkflowResponseDtoSchema, payload);
}

export function parseCreateImageSystemRequestDto(payload: unknown): CreateImageSystemRequestDtoPayload {
  return parseSchema("CreateImageSystemRequestDto", CreateImageSystemRequestDtoSchema, payload);
}

export function parseCreateImageSystemResponseDto(payload: unknown): CreateImageSystemResponseDtoPayload {
  return parseSchema("CreateImageSystemResponseDto", CreateImageSystemResponseDtoSchema, payload);
}

export function parseUpdateImageSystemRequestDto(payload: unknown): UpdateImageSystemRequestDtoPayload {
  return parseSchema("UpdateImageSystemRequestDto", UpdateImageSystemRequestDtoSchema, payload);
}

export function parseUpdateImageSystemResponseDto(payload: unknown): UpdateImageSystemResponseDtoPayload {
  return parseSchema("UpdateImageSystemResponseDto", UpdateImageSystemResponseDtoSchema, payload);
}

export function parseGetImageSystemRequestDto(payload: unknown): GetImageSystemRequestDtoPayload {
  return parseSchema("GetImageSystemRequestDto", GetImageSystemRequestDtoSchema, payload);
}

export function parseGetImageSystemResponseDto(payload: unknown): GetImageSystemResponseDtoPayload {
  return parseSchema("GetImageSystemResponseDto", GetImageSystemResponseDtoSchema, payload);
}

export function parseListImageSystemsRequestDto(payload: unknown): ListImageSystemsRequestDtoPayload {
  return parseSchema("ListImageSystemsRequestDto", ListImageSystemsRequestDtoSchema, payload);
}

export function parseListImageSystemsResponseDto(payload: unknown): ListImageSystemsResponseDtoPayload {
  return parseSchema("ListImageSystemsResponseDto", ListImageSystemsResponseDtoSchema, payload);
}

export function parseValidateImageSystemRequestDto(payload: unknown): ValidateImageSystemRequestDtoPayload {
  return parseSchema("ValidateImageSystemRequestDto", ValidateImageSystemRequestDtoSchema, payload);
}

export function parseValidateImageSystemResponseDto(payload: unknown): ValidateImageSystemResponseDtoPayload {
  return parseSchema("ValidateImageSystemResponseDto", ValidateImageSystemResponseDtoSchema, payload);
}
