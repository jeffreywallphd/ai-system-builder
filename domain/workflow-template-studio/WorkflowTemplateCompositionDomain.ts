import { z } from "zod";

export const WorkflowTemplateCompositionContractVersion = "1.0.0";

export const WorkflowTemplateParameterValueTypes = Object.freeze({
  string: "string",
  number: "number",
  integer: "integer",
  boolean: "boolean",
  json: "json",
  enum: "enum",
} as const);

export type WorkflowTemplateParameterValueType =
  typeof WorkflowTemplateParameterValueTypes[keyof typeof WorkflowTemplateParameterValueTypes];

export const WorkflowTemplateParameterSchema = z.object({
  parameterId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.nativeEnum(WorkflowTemplateParameterValueTypes),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    pattern: z.string().trim().min(1).optional(),
    enumValues: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
  uiHints: z.object({
    label: z.string().trim().min(1).optional(),
    helpText: z.string().trim().min(1).optional(),
    group: z.string().trim().min(1).optional(),
    control: z.enum(["text", "textarea", "number", "toggle", "select"]).optional(),
  }).optional(),
  dependencyRules: z.array(z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("requires-when-set"),
      parameterId: z.string().trim().min(1),
    }),
    z.object({
      kind: z.literal("requires-when-equals"),
      parameterId: z.string().trim().min(1),
      equals: z.unknown(),
    }),
  ])).optional(),
});

export type WorkflowTemplateParameterDefinition = z.infer<typeof WorkflowTemplateParameterSchema>;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

const workflowInterfaceSchema = z.object({
  workflowAssetId: z.string().trim().min(1),
  workflowAssetVersionId: z.string().trim().min(1).optional(),
  inputIds: z.array(z.string().trim().min(1)).default([]),
  outputIds: z.array(z.string().trim().min(1)).default([]),
  parameterIds: z.array(z.string().trim().min(1)).default([]),
});

const inputBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  templateInputId: z.string().trim().min(1),
  workflowAssetId: z.string().trim().min(1),
  workflowInputId: z.string().trim().min(1),
  required: z.boolean().default(false),
});

const outputBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  templateOutputId: z.string().trim().min(1),
  workflowAssetId: z.string().trim().min(1),
  workflowOutputId: z.string().trim().min(1),
  targetDatasetAssetId: z.string().trim().min(1).optional(),
  targetDatasetVersionId: z.string().trim().min(1).optional(),
});

const parameterMappingSchema = z.object({
  parameterId: z.string().trim().min(1),
  workflowAssetId: z.string().trim().min(1),
  workflowParameterId: z.string().trim().min(1),
});

const systemContextMappingSchema = z.object({
  mappingId: z.string().trim().min(1),
  contextKey: z.string().trim().min(1),
  workflowAssetId: z.string().trim().min(1),
  targetKind: z.enum(["workflow-input", "workflow-parameter"]),
  targetId: z.string().trim().min(1),
});

export const WorkflowTemplateCompositionSchema = z.object({
  contractVersion: z.string().trim().min(1).default(WorkflowTemplateCompositionContractVersion),
  workflowInterfaces: z.array(workflowInterfaceSchema).min(1),
  inputBindings: z.array(inputBindingSchema).default([]),
  outputBindings: z.array(outputBindingSchema).default([]),
  parameterMappings: z.array(parameterMappingSchema).default([]),
  systemContextMappings: z.array(systemContextMappingSchema).default([]),
});

export type WorkflowTemplateComposition = z.infer<typeof WorkflowTemplateCompositionSchema>;

function dedupe(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values)]);
}

export function createWorkflowTemplateComposition(input: unknown): WorkflowTemplateComposition {
  const parsed = WorkflowTemplateCompositionSchema.parse(input);

  const workflowIds = parsed.workflowInterfaces.map((entry) => entry.workflowAssetId);
  if (new Set(workflowIds).size !== workflowIds.length) {
    throw new Error("Workflow template composition cannot include duplicate workflow interfaces.");
  }

  const bindingIds = [...parsed.inputBindings.map((entry) => entry.bindingId), ...parsed.outputBindings.map((entry) => entry.bindingId)];
  if (new Set(bindingIds).size !== bindingIds.length) {
    throw new Error("Workflow template composition binding ids must be unique.");
  }

  const interfaceIds = new Set(workflowIds);
  for (const binding of parsed.inputBindings) {
    if (!interfaceIds.has(binding.workflowAssetId)) {
      throw new Error(`Input binding '${binding.bindingId}' references unknown workflow interface '${binding.workflowAssetId}'.`);
    }
  }
  for (const binding of parsed.outputBindings) {
    if (!interfaceIds.has(binding.workflowAssetId)) {
      throw new Error(`Output binding '${binding.bindingId}' references unknown workflow interface '${binding.workflowAssetId}'.`);
    }
  }
  for (const mapping of parsed.parameterMappings) {
    if (!interfaceIds.has(mapping.workflowAssetId)) {
      throw new Error(`Parameter mapping '${mapping.parameterId}' references unknown workflow interface '${mapping.workflowAssetId}'.`);
    }
  }

  return Object.freeze({
    ...parsed,
    workflowInterfaces: Object.freeze(parsed.workflowInterfaces.map((entry) => Object.freeze({
      ...entry,
      inputIds: dedupe(entry.inputIds),
      outputIds: dedupe(entry.outputIds),
      parameterIds: dedupe(entry.parameterIds),
    }))),
    inputBindings: Object.freeze(parsed.inputBindings.map((entry) => Object.freeze({ ...entry }))),
    outputBindings: Object.freeze(parsed.outputBindings.map((entry) => Object.freeze({ ...entry }))),
    parameterMappings: Object.freeze(parsed.parameterMappings.map((entry) => Object.freeze({ ...entry }))),
    systemContextMappings: Object.freeze(parsed.systemContextMappings.map((entry) => Object.freeze({ ...entry }))),
  });
}

function createParameterValueSchema(parameter: WorkflowTemplateParameterDefinition): z.ZodTypeAny {
  switch (parameter.type) {
    case WorkflowTemplateParameterValueTypes.string: {
      let schema = z.string();
      if (parameter.validation?.minLength !== undefined) schema = schema.min(parameter.validation.minLength);
      if (parameter.validation?.maxLength !== undefined) schema = schema.max(parameter.validation.maxLength);
      if (parameter.validation?.pattern) schema = schema.regex(new RegExp(parameter.validation.pattern));
      return schema;
    }
    case WorkflowTemplateParameterValueTypes.number: {
      let schema = z.number();
      if (parameter.validation?.min !== undefined) schema = schema.min(parameter.validation.min);
      if (parameter.validation?.max !== undefined) schema = schema.max(parameter.validation.max);
      return schema;
    }
    case WorkflowTemplateParameterValueTypes.integer: {
      let schema = z.number().int();
      if (parameter.validation?.min !== undefined) schema = schema.min(parameter.validation.min);
      if (parameter.validation?.max !== undefined) schema = schema.max(parameter.validation.max);
      return schema;
    }
    case WorkflowTemplateParameterValueTypes.boolean:
      return z.boolean();
    case WorkflowTemplateParameterValueTypes.enum:
      return z.enum(parameter.validation!.enumValues as [string, ...string[]]);
    case WorkflowTemplateParameterValueTypes.json:
      return jsonValueSchema;
    default:
      return z.unknown();
  }
}

export function createWorkflowTemplateParameterDefinition(input: unknown): WorkflowTemplateParameterDefinition {
  const parsed = WorkflowTemplateParameterSchema.parse(input);
  if (parsed.type === WorkflowTemplateParameterValueTypes.enum && (!parsed.validation?.enumValues || parsed.validation.enumValues.length === 0)) {
    throw new Error(`Enum parameter '${parsed.parameterId}' requires at least one enum value.`);
  }
  if (parsed.validation?.min !== undefined && parsed.validation?.max !== undefined && parsed.validation.min > parsed.validation.max) {
    throw new Error(`Parameter '${parsed.parameterId}' has invalid numeric validation range.`);
  }
  if (parsed.validation?.minLength !== undefined && parsed.validation?.maxLength !== undefined && parsed.validation.minLength > parsed.validation.maxLength) {
    throw new Error(`Parameter '${parsed.parameterId}' has invalid length validation range.`);
  }
  for (const rule of parsed.dependencyRules ?? []) {
    if (rule.parameterId === parsed.parameterId) {
      throw new Error(`Parameter '${parsed.parameterId}' cannot depend on itself.`);
    }
  }

  const schema = createParameterValueSchema(parsed);
  if (parsed.defaultValue !== undefined) {
    const defaultResult = schema.safeParse(parsed.defaultValue);
    if (!defaultResult.success) {
      throw new Error(`Default value for template parameter '${parsed.parameterId}' is invalid.`);
    }
  }

  return Object.freeze({
    ...parsed,
    validation: parsed.validation ? Object.freeze({ ...parsed.validation }) : undefined,
    uiHints: parsed.uiHints ? Object.freeze({ ...parsed.uiHints }) : undefined,
    dependencyRules: parsed.dependencyRules ? Object.freeze(parsed.dependencyRules.map((entry) => Object.freeze({ ...entry }))) : undefined,
  });
}

export function createTemplateParameterSchema(
  definitions: ReadonlyArray<WorkflowTemplateParameterDefinition>,
): z.ZodType<Readonly<Record<string, unknown>>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const definition of definitions) {
    let schema = createParameterValueSchema(definition);
    if (!definition.required) {
      schema = schema.optional();
    }
    shape[definition.parameterId] = schema;
  }

  return z.object(shape).strict();
}
