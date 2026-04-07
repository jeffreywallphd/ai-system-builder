import {
  z,
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEffects,
  ZodEnum,
  ZodNativeEnum,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodString,
  type ZodTypeAny,
} from "zod";
import type { ITransformationAsset } from "./TransformationContracts";
import type { TransformationAssetRegistry } from "./TransformationAssetRegistry";
import type { TransformationPipelineStepDefinition } from "./TransformationPipeline";
import {
  TransformationAssetConfigUxDescriptorSchema,
  TransformationConfigUxFieldKinds,
  TransformationConfigUxVisibilities,
  TransformationPipelineStepConfigUxDescriptorSchema,
  type TransformationAssetConfigUxDescriptor,
  type TransformationConfigUxFieldDescriptor,
  type TransformationConfigUxFieldKind,
  type TransformationConfigUxOption,
  type TransformationConfigUxSectionDescriptor,
  type TransformationConfigUxValidationConstraint,
  type TransformationConfigUxVisibility,
  type TransformationPipelineStepConfigUxDescriptor,
} from "./TransformationConfigUxContracts";

interface FieldUxOverride {
  readonly label?: string;
  readonly description?: string;
  readonly visibility?: TransformationConfigUxVisibility;
  readonly sectionId?: string;
}

interface AssetUxOverride {
  readonly sections: ReadonlyArray<TransformationConfigUxSectionDescriptor>;
  readonly fields: Readonly<Record<string, FieldUxOverride>>;
}

function titleCaseFromKey(value: string): string {
  const withSpaces = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
  return withSpaces
    .split(" ")
    .filter((entry) => entry.length > 0)
    .map((entry) => `${entry[0]!.toUpperCase()}${entry.slice(1)}`)
    .join(" ");
}

const DefaultSections: ReadonlyArray<TransformationConfigUxSectionDescriptor> = Object.freeze([
  Object.freeze({
    id: "core",
    label: "Core Settings",
    description: "Primary settings shown in simple authoring flows.",
  }),
  Object.freeze({
    id: "advanced",
    label: "Advanced Settings",
    description: "Optional controls for deeper tuning and diagnostics.",
  }),
]);

const AssetUxOverrides: Readonly<Record<string, AssetUxOverride>> = Object.freeze({
  "schema-inference": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      inferenceMode: Object.freeze({ sectionId: "core" }),
      sampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  "data-profiling": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      computeNumericStats: Object.freeze({ sectionId: "core" }),
      computeDistinctCounts: Object.freeze({ sectionId: "core" }),
      sampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      maxSampleValuesPerField: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  "field-mapping": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      mappings: Object.freeze({ sectionId: "core" }),
      preserveUnmapped: Object.freeze({ sectionId: "core" }),
      dropEmptyTargets: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  "type-normalization": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      fieldRules: Object.freeze({ sectionId: "core" }),
      inferredFieldTypes: Object.freeze({ sectionId: "core" }),
      trimStrings: Object.freeze({ sectionId: "core" }),
      emptyStringAsNull: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      onConversionFailure: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  "missing-value-handling": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      strategy: Object.freeze({ sectionId: "core" }),
      targetFields: Object.freeze({ sectionId: "core" }),
      defaultFillValue: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      perFieldFillValues: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      perFieldOverrides: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      treatEmptyStringAsMissing: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      treatWhitespaceAsMissing: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      rowDropMode: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  deduplication: Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      mode: Object.freeze({ sectionId: "core" }),
      matchFields: Object.freeze({ sectionId: "core" }),
      keepStrategy: Object.freeze({ sectionId: "core" }),
      fuzzyFields: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      maxDistance: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      caseSensitive: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      trimStrings: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      treatMissingAsNull: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  "data-validation": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      fieldRules: Object.freeze({ sectionId: "core" }),
      requiredFields: Object.freeze({ sectionId: "core" }),
      invalidRowStrategy: Object.freeze({ sectionId: "core" }),
      annotationFieldName: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      treatEmptyStringAsMissing: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      treatWhitespaceAsMissing: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  "data-classification": Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      enabledClassifiers: Object.freeze({ sectionId: "core" }),
      confidenceThreshold: Object.freeze({ sectionId: "core" }),
      includeFields: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      excludeFields: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      emitFieldLevelTags: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      emitRecordLevelTags: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      useFieldNames: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      inferredFieldTypes: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      maxSampleValuesPerField: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      sampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  filtering: Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      mode: Object.freeze({ sectionId: "core" }),
      logicalOperator: Object.freeze({ sectionId: "core" }),
      conditions: Object.freeze({ sectionId: "core" }),
      caseSensitive: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      trimStrings: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      treatMissingAsNull: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
  aggregation: Object.freeze({
    sections: DefaultSections,
    fields: Object.freeze({
      groupByFields: Object.freeze({ sectionId: "core" }),
      aggregations: Object.freeze({ sectionId: "core" }),
      nullHandlingMode: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
      previewSampleSize: Object.freeze({ sectionId: "advanced", visibility: TransformationConfigUxVisibilities.advanced }),
    }),
  }),
});

interface UnwrappedZod {
  readonly schema: ZodTypeAny;
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

function unwrapSchema(schema: ZodTypeAny): UnwrappedZod {
  let cursor = schema;
  let required = true;
  let defaultValue: unknown = undefined;

  while (true) {
    if (cursor instanceof ZodEffects) {
      cursor = cursor.innerType();
      continue;
    }
    if (cursor instanceof ZodOptional) {
      required = false;
      cursor = cursor.unwrap();
      continue;
    }
    if (cursor instanceof ZodNullable) {
      cursor = cursor.unwrap();
      continue;
    }
    if (cursor instanceof ZodDefault) {
      required = false;
      defaultValue = cursor._def.defaultValue();
      cursor = cursor.removeDefault();
      continue;
    }
    break;
  }

  return Object.freeze({ schema: cursor, required, defaultValue });
}

function inferKind(schema: ZodTypeAny): TransformationConfigUxFieldKind {
  if (schema instanceof ZodString) {
    return TransformationConfigUxFieldKinds.string;
  }
  if (schema instanceof ZodNumber) {
    return TransformationConfigUxFieldKinds.number;
  }
  if (schema instanceof ZodBoolean) {
    return TransformationConfigUxFieldKinds.boolean;
  }
  if (schema instanceof ZodEnum || schema instanceof ZodNativeEnum) {
    return TransformationConfigUxFieldKinds.enum;
  }
  if (schema instanceof ZodArray) {
    return TransformationConfigUxFieldKinds.array;
  }
  if (schema instanceof ZodObject) {
    return TransformationConfigUxFieldKinds.object;
  }
  if (schema instanceof ZodRecord) {
    return TransformationConfigUxFieldKinds.record;
  }
  return TransformationConfigUxFieldKinds.unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getConstraints(schema: ZodTypeAny): ReadonlyArray<TransformationConfigUxValidationConstraint> | undefined {
  if (schema instanceof ZodString || schema instanceof ZodNumber || schema instanceof ZodArray) {
    const checks = asRecord((schema as unknown as { _def?: unknown })._def).checks;
    if (!Array.isArray(checks) || checks.length === 0) {
      return undefined;
    }

    const constraints: TransformationConfigUxValidationConstraint[] = [];
    for (const check of checks) {
      const checkRecord = asRecord(check);
      const kind = typeof checkRecord.kind === "string" ? checkRecord.kind : undefined;
      if (!kind) {
        continue;
      }
      if (typeof checkRecord.value === "number") {
        constraints.push(Object.freeze({ key: kind, value: checkRecord.value }));
        continue;
      }
      if (typeof checkRecord.inclusive === "boolean") {
        constraints.push(Object.freeze({ key: `${kind}Inclusive`, value: checkRecord.inclusive }));
      }
      if (typeof checkRecord.message === "string" && checkRecord.message.length > 0) {
        constraints.push(Object.freeze({ key: `${kind}Message`, value: checkRecord.message }));
      }
    }
    return constraints.length > 0 ? Object.freeze(constraints) : undefined;
  }
  return undefined;
}

function getOptions(schema: ZodTypeAny): ReadonlyArray<TransformationConfigUxOption> | undefined {
  if (schema instanceof ZodEnum) {
    return Object.freeze(schema.options.map((entry) => Object.freeze({
      value: entry,
      label: titleCaseFromKey(entry),
    })));
  }
  if (schema instanceof ZodNativeEnum) {
    const enumValues = Object.values(schema.enum).filter((entry): entry is string | number | boolean =>
      typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean");
    const unique = [...new Set(enumValues.map((entry) => String(entry)))];
    return Object.freeze(unique.map((entry) => Object.freeze({
      value: entry,
      label: titleCaseFromKey(entry),
    })));
  }
  return undefined;
}

function defaultVisibilityForKey(key: string): TransformationConfigUxVisibility {
  const lower = key.toLocaleLowerCase();
  if (lower.includes("preview") || lower.includes("sample") || lower.includes("max")) {
    return TransformationConfigUxVisibilities.advanced;
  }
  return TransformationConfigUxVisibilities.simple;
}

function ensureOverlayMatchesSchema(assetId: string, schemaKeys: ReadonlyArray<string>): void {
  const override = AssetUxOverrides[assetId];
  if (!override) {
    return;
  }
  for (const fieldName of Object.keys(override.fields)) {
    if (!schemaKeys.includes(fieldName)) {
      throw new Error(`Config UX override for '${assetId}' references unknown config field '${fieldName}'.`);
    }
  }
}

function toFieldDescriptor(
  assetId: string,
  fieldKey: string,
  schema: ZodTypeAny,
): TransformationConfigUxFieldDescriptor {
  const unwrapped = unwrapSchema(schema);
  const overlay = AssetUxOverrides[assetId]?.fields[fieldKey];
  return Object.freeze({
    key: fieldKey,
    label: overlay?.label ?? titleCaseFromKey(fieldKey),
    description: overlay?.description,
    kind: inferKind(unwrapped.schema),
    required: unwrapped.required,
    visibility: overlay?.visibility ?? defaultVisibilityForKey(fieldKey),
    sectionId: overlay?.sectionId ?? (defaultVisibilityForKey(fieldKey) === TransformationConfigUxVisibilities.simple ? "core" : "advanced"),
    defaultValue: unwrapped.defaultValue,
    options: getOptions(unwrapped.schema),
    constraints: getConstraints(unwrapped.schema),
  });
}

function resolveConfigObjectSchema(asset: ITransformationAsset): ZodObject<z.ZodRawShape> {
  const configSchema = asset.configSchema;
  const unwrapped = unwrapSchema(configSchema);
  if (!(unwrapped.schema instanceof ZodObject)) {
    throw new Error(`Transformation asset '${asset.id}' config schema must be a zod object.`);
  }
  return unwrapped.schema;
}

export function buildTransformationAssetConfigDescriptor(
  asset: ITransformationAsset,
): TransformationAssetConfigUxDescriptor {
  const configObjectSchema = resolveConfigObjectSchema(asset);
  const shape = configObjectSchema.shape;
  const keys = Object.keys(shape);
  ensureOverlayMatchesSchema(asset.id, keys);

  const fields = Object.freeze(keys.map((key) => toFieldDescriptor(asset.id, key, shape[key]!)));
  const sections = AssetUxOverrides[asset.id]?.sections ?? DefaultSections;
  const descriptor = Object.freeze({
    contractVersion: "1.0.0" as const,
    generatedAt: new Date().toISOString(),
    assetId: asset.id,
    assetVersion: asset.version,
    assetName: asset.name,
    assetDescription: asset.description,
    sections: Object.freeze(sections),
    fields,
  });
  return TransformationAssetConfigUxDescriptorSchema.parse(descriptor);
}

export function listTransformationAssetConfigDescriptors(
  registry: TransformationAssetRegistry,
): ReadonlyArray<TransformationAssetConfigUxDescriptor> {
  return Object.freeze(registry.list().map((entry) => buildTransformationAssetConfigDescriptor(entry.asset)));
}

const PipelineStepFields: ReadonlyArray<TransformationConfigUxFieldDescriptor> = Object.freeze([
  Object.freeze({
    key: "stepId",
    label: "Step Id",
    description: "Pipeline-local step identity.",
    kind: TransformationConfigUxFieldKinds.string,
    required: true,
    visibility: TransformationConfigUxVisibilities.simple,
    sectionId: "core",
    constraints: Object.freeze([{ key: "minLength", value: 1 }]),
  }),
  Object.freeze({
    key: "assetId",
    label: "Asset Id",
    description: "Transformation asset id from the registry.",
    kind: TransformationConfigUxFieldKinds.string,
    required: true,
    visibility: TransformationConfigUxVisibilities.simple,
    sectionId: "core",
    constraints: Object.freeze([{ key: "minLength", value: 1 }]),
  }),
  Object.freeze({
    key: "assetVersion",
    label: "Asset Version",
    description: "Optional explicit version selection.",
    kind: TransformationConfigUxFieldKinds.string,
    required: false,
    visibility: TransformationConfigUxVisibilities.advanced,
    sectionId: "advanced",
  }),
  Object.freeze({
    key: "metadata",
    label: "Metadata",
    description: "Optional orchestration metadata for stage/wizard/canvas projection.",
    kind: TransformationConfigUxFieldKinds.object,
    required: false,
    visibility: TransformationConfigUxVisibilities.advanced,
    sectionId: "advanced",
  }),
]);

export function buildTransformationPipelineStepConfigDescriptor(input: {
  readonly step: TransformationPipelineStepDefinition;
  readonly registry: TransformationAssetRegistry;
}): TransformationPipelineStepConfigUxDescriptor {
  const resolved = input.registry.get({
    id: input.step.assetId,
    version: input.step.assetVersion,
  });
  if (!resolved) {
    throw new Error(
      `Cannot build config UX descriptor for step '${input.step.stepId}': asset '${input.step.assetId}'${input.step.assetVersion ? `@${input.step.assetVersion}` : ""} is not registered.`,
    );
  }

  const descriptor = Object.freeze({
    contractVersion: "1.0.0" as const,
    generatedAt: new Date().toISOString(),
    stepId: input.step.stepId,
    assetId: resolved.asset.id,
    assetVersion: resolved.asset.version,
    fields: PipelineStepFields,
    assetConfig: buildTransformationAssetConfigDescriptor(resolved.asset),
  });
  return TransformationPipelineStepConfigUxDescriptorSchema.parse(descriptor);
}
