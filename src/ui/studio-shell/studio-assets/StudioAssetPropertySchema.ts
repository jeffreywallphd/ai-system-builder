import type {
  StudioAssetPropertyField,
  StudioAssetPropertySchema,
  StudioAssetPropertySection,
  StudioAssetPropertyVisibilityRule,
} from "./StudioAssetContracts";

export interface StudioAssetPropertySchemaValidationIssue {
  readonly path: string;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getValueAtPath(config: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => (
    isRecord(current) ? current[segment] : undefined
  ), config);
}

function setValueAtPath(config: Readonly<Record<string, unknown>>, path: string, value: unknown): Readonly<Record<string, unknown>> {
  const segments = path.split(".").filter((entry) => entry.length > 0);
  if (segments.length === 0) {
    return config;
  }

  const result: Record<string, unknown> = { ...config };
  let cursor: Record<string, unknown> = result;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const existing = cursor[segment];
    const nextLevel = isRecord(existing) ? { ...existing } : {};
    cursor[segment] = nextLevel;
    cursor = nextLevel;
  });

  return Object.freeze(result);
}

function evaluateVisibilityRule(input: {
  readonly rule?: StudioAssetPropertyVisibilityRule;
  readonly config: Readonly<Record<string, unknown>>;
}): boolean {
  if (!input.rule) {
    return true;
  }

  const current = getValueAtPath(input.config, input.rule.field);
  if (Object.prototype.hasOwnProperty.call(input.rule, "equals")) {
    return current === input.rule.equals;
  }
  if (Object.prototype.hasOwnProperty.call(input.rule, "notEquals")) {
    return current !== input.rule.notEquals;
  }
  return true;
}

export function isStudioAssetPropertyFieldVisible(input: {
  readonly field: StudioAssetPropertyField;
  readonly config: Readonly<Record<string, unknown>>;
}): boolean {
  if (input.field.hidden) {
    return false;
  }
  return evaluateVisibilityRule({ rule: input.field.visibilityRule, config: input.config });
}

export function applyStudioAssetPropertySchemaDefaults(input: {
  readonly schema: StudioAssetPropertySchema;
  readonly config?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  let nextConfig: Readonly<Record<string, unknown>> = Object.freeze({ ...(input.config ?? {}) });
  for (const section of input.schema.sections) {
    for (const field of section.fields) {
      const current = getValueAtPath(nextConfig, field.path);
      if (current === undefined && field.defaultValue !== undefined) {
        nextConfig = setValueAtPath(nextConfig, field.path, field.defaultValue);
      }
    }
  }
  return nextConfig;
}

export function listVisibleStudioAssetPropertySections(input: {
  readonly schema: StudioAssetPropertySchema;
  readonly config: Readonly<Record<string, unknown>>;
}): ReadonlyArray<StudioAssetPropertySection> {
  return Object.freeze(
    input.schema.sections
      .map((section) => Object.freeze({
        ...section,
        fields: Object.freeze(section.fields.filter((field) => isStudioAssetPropertyFieldVisible({
          field,
          config: input.config,
        }))),
      }))
      .filter((section) => section.fields.length > 0),
  );
}

export function validateStudioAssetPropertySchema(input: {
  readonly schema: StudioAssetPropertySchema;
  readonly config: Readonly<Record<string, unknown>>;
}): ReadonlyArray<StudioAssetPropertySchemaValidationIssue> {
  const issues: StudioAssetPropertySchemaValidationIssue[] = [];
  for (const section of input.schema.sections) {
    for (const field of section.fields) {
      if (!isStudioAssetPropertyFieldVisible({ field, config: input.config })) {
        continue;
      }
      if (!field.required) {
        continue;
      }
      const value = getValueAtPath(input.config, field.path);
      const missing = value === undefined
        || value === null
        || (typeof value === "string" && value.trim().length === 0);
      if (missing) {
        issues.push({
          path: field.path,
          message: `${field.label} is required.`,
        });
      }
    }
  }
  return Object.freeze(issues);
}

export function updateStudioAssetConfigByField(input: {
  readonly config: Readonly<Record<string, unknown>>;
  readonly fieldPath: string;
  readonly value: unknown;
}): Readonly<Record<string, unknown>> {
  return setValueAtPath(input.config, input.fieldPath, input.value);
}
