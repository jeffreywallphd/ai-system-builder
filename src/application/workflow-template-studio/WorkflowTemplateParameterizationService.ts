import {
  createTemplateParameterSchema,
  type WorkflowTemplateParameterDefinition,
} from "@domain/workflow-template-studio/WorkflowTemplateCompositionDomain";

export interface AppliedTemplateParameters {
  readonly values: Readonly<Record<string, unknown>>;
  readonly definitions: ReadonlyArray<WorkflowTemplateParameterDefinition>;
}

export function applyWorkflowTemplateParameterDefaults(input: {
  readonly definitions: ReadonlyArray<WorkflowTemplateParameterDefinition>;
  readonly overrides?: Readonly<Record<string, unknown>>;
}): AppliedTemplateParameters {
  const definitions = Object.freeze(input.definitions.map((entry) => Object.freeze({ ...entry })));
  const schema = createTemplateParameterSchema(definitions);
  const defaults = definitions.reduce<Record<string, unknown>>((acc, definition) => {
    if (definition.defaultValue !== undefined) {
      acc[definition.parameterId] = definition.defaultValue;
    }
    return acc;
  }, {});

  const merged = { ...defaults, ...(input.overrides ?? {}) };
  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ");
    throw new Error(`Invalid workflow template parameters: ${issues}`);
  }

  for (const definition of definitions) {
    if (definition.required && parsed.data[definition.parameterId] === undefined) {
      throw new Error(`Missing required workflow template parameter '${definition.parameterId}'.`);
    }
  }

  const byId = new Map(definitions.map((entry) => [entry.parameterId, entry] as const));
  for (const definition of definitions) {
    for (const rule of definition.dependencyRules ?? []) {
      if (!byId.has(rule.parameterId)) {
        throw new Error(`Parameter '${definition.parameterId}' has dependency on unknown parameter '${rule.parameterId}'.`);
      }

      const value = parsed.data[definition.parameterId];
      const requiredValue = parsed.data[rule.parameterId];
      if (rule.kind === "requires-when-set") {
        if (value !== undefined && requiredValue === undefined) {
          throw new Error(`Parameter '${rule.parameterId}' is required when '${definition.parameterId}' is set.`);
        }
      }
      if (rule.kind === "requires-when-equals") {
        if (value === rule.equals && requiredValue === undefined) {
          throw new Error(`Parameter '${rule.parameterId}' is required when '${definition.parameterId}' equals the configured dependency value.`);
        }
      }
    }
  }

  return Object.freeze({
    values: Object.freeze({ ...parsed.data }),
    definitions,
  });
}

