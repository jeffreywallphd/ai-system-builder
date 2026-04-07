import type { DataAssetBase } from "../../domain/dataset-studio/DataAssetBase";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";

export const DataAssetConfigFieldKinds = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  select: "select",
  json: "json",
} as const);

export type DataAssetConfigFieldKind = typeof DataAssetConfigFieldKinds[keyof typeof DataAssetConfigFieldKinds];

export interface DataAssetConfigFieldOption {
  readonly value: string;
  readonly label: string;
}

export const DataAssetConfigFieldVisibilities = Object.freeze({
  simple: "simple",
  advanced: "advanced",
} as const);

export type DataAssetConfigFieldVisibility =
  typeof DataAssetConfigFieldVisibilities[keyof typeof DataAssetConfigFieldVisibilities];

export interface DataAssetConfigFieldSchema {
  readonly key: string;
  readonly label: string;
  readonly kind: DataAssetConfigFieldKind;
  readonly visibility?: DataAssetConfigFieldVisibility;
  readonly description?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly defaultValue?: CanonicalRecordValue;
  readonly min?: number;
  readonly max?: number;
  readonly options?: ReadonlyArray<DataAssetConfigFieldOption>;
}

export interface DataAssetConfigSchema {
  readonly schemaId: string;
  readonly version: string;
  readonly fields: ReadonlyArray<DataAssetConfigFieldSchema>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptions(options?: ReadonlyArray<DataAssetConfigFieldOption>): ReadonlyArray<DataAssetConfigFieldOption> | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }

  const deduped = new Map<string, DataAssetConfigFieldOption>();
  for (const option of options) {
    const value = option.value.trim();
    const label = option.label.trim();
    if (!value || !label) {
      continue;
    }
    deduped.set(value, Object.freeze({ value, label }));
  }

  if (deduped.size === 0) {
    return undefined;
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeFieldSchema(field: DataAssetConfigFieldSchema): DataAssetConfigFieldSchema {
  const key = field.key.trim();
  if (!key) {
    throw new Error("Data asset config field key is required.");
  }

  const label = field.label.trim();
  if (!label) {
    throw new Error(`Data asset config field '${key}' label is required.`);
  }

  const options = normalizeOptions(field.options);
  if (field.kind === DataAssetConfigFieldKinds.select && (!options || options.length === 0)) {
    throw new Error(`Data asset config select field '${key}' requires options.`);
  }

  return Object.freeze({
    key,
    label,
    kind: field.kind,
    visibility: field.visibility ?? DataAssetConfigFieldVisibilities.simple,
    description: normalizeOptional(field.description),
    placeholder: normalizeOptional(field.placeholder),
    required: Boolean(field.required),
    defaultValue: field.defaultValue,
    min: typeof field.min === "number" ? field.min : undefined,
    max: typeof field.max === "number" ? field.max : undefined,
    options,
  });
}

export function createDataAssetConfigSchema(input: {
  readonly schemaId: string;
  readonly version?: string;
  readonly fields: ReadonlyArray<DataAssetConfigFieldSchema>;
}): DataAssetConfigSchema {
  const schemaId = input.schemaId.trim();
  if (!schemaId) {
    throw new Error("Data asset config schema id is required.");
  }

  if (input.fields.length === 0) {
    throw new Error(`Data asset config schema '${schemaId}' must include at least one field.`);
  }

  const fields = Object.freeze(input.fields.map((field) => normalizeFieldSchema(field)));
  return Object.freeze({
    schemaId,
    version: normalizeOptional(input.version) ?? "1.0.0",
    fields,
  });
}

function inferFieldKind(value: CanonicalRecordValue): DataAssetConfigFieldKind {
  if (typeof value === "boolean") {
    return DataAssetConfigFieldKinds.boolean;
  }

  if (typeof value === "number") {
    return DataAssetConfigFieldKinds.number;
  }

  if (typeof value === "string") {
    return DataAssetConfigFieldKinds.string;
  }

  return DataAssetConfigFieldKinds.json;
}

function titleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
}

export function inferDataAssetConfigSchema(asset: DataAssetBase): DataAssetConfigSchema {
  const keys = Object.keys(asset.config.values).sort((left, right) => left.localeCompare(right));
  const fields = keys.length === 0
    ? [
      Object.freeze({
        key: "notes",
        label: "Notes",
        kind: DataAssetConfigFieldKinds.string,
        description: "Optional notes stored on the data asset config surface.",
      } satisfies DataAssetConfigFieldSchema),
    ]
    : keys.map((key) => Object.freeze({
      key,
      label: titleCase(key),
      kind: inferFieldKind(asset.config.values[key]!),
      defaultValue: asset.config.values[key],
    } satisfies DataAssetConfigFieldSchema));

  return createDataAssetConfigSchema({
    schemaId: `data-asset.${asset.id}.config`,
    version: asset.versionMetadata.schemaVersion,
    fields: Object.freeze(fields),
  });
}

export function resolveDataAssetConfigDefaults(
  schema: DataAssetConfigSchema,
  configValues?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  const resolved = new Map<string, CanonicalRecordValue>();

  for (const field of schema.fields) {
    if (field.defaultValue !== undefined) {
      resolved.set(field.key, field.defaultValue);
    }
  }

  for (const [key, value] of Object.entries(configValues ?? {})) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }
    resolved.set(normalizedKey, value);
  }

  return Object.freeze(Object.fromEntries(resolved.entries()));
}
