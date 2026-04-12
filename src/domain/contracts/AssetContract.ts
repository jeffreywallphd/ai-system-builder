export const AssetContractShapeKinds = Object.freeze({
  jsonSchema: "json-schema",
  text: "text",
  opaque: "opaque",
});

export type AssetContractShapeKind = typeof AssetContractShapeKinds[keyof typeof AssetContractShapeKinds];

export interface AssetContractShapeDescriptor {
  readonly kind: AssetContractShapeKind;
  readonly description?: string;
  readonly schema?: Readonly<Record<string, unknown>>;
}

export interface AssetContractParameterDescriptor {
  readonly id: string;
  readonly description?: string;
  readonly required: boolean;
  readonly valueType?: string;
  readonly defaultValue?: unknown;
}

export interface AssetContractExecutionMetadata {
  readonly invocationMode?: "sync" | "async" | "deferred";
  readonly sideEffects?: "none" | "bounded" | "external";
}

export interface AssetContractDescriptor {
  readonly version: string;
  readonly input?: AssetContractShapeDescriptor;
  readonly output?: AssetContractShapeDescriptor;
  readonly parameters: ReadonlyArray<AssetContractParameterDescriptor>;
  readonly execution?: AssetContractExecutionMetadata;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeShape(shape?: AssetContractShapeDescriptor): AssetContractShapeDescriptor | undefined {
  if (!shape) {
    return undefined;
  }

  if (!Object.values(AssetContractShapeKinds).includes(shape.kind)) {
    throw new Error("Asset contract shape kind must be json-schema, text, or opaque.");
  }

  return Object.freeze({
    kind: shape.kind,
    description: normalizeOptional(shape.description),
    schema: shape.schema ? Object.freeze(JSON.parse(JSON.stringify(shape.schema)) as Record<string, unknown>) : undefined,
  });
}

function normalizeParameters(
  parameters?: ReadonlyArray<AssetContractParameterDescriptor>,
): ReadonlyArray<AssetContractParameterDescriptor> {
  const deduped = new Map<string, AssetContractParameterDescriptor>();

  for (const parameter of parameters ?? []) {
    const id = parameter.id.trim();
    if (!id) {
      throw new Error("Asset contract parameters require a non-empty id.");
    }

    deduped.set(id, Object.freeze({
      id,
      description: normalizeOptional(parameter.description),
      required: parameter.required,
      valueType: normalizeOptional(parameter.valueType),
      defaultValue: parameter.defaultValue,
    }));
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeExecution(metadata?: AssetContractExecutionMetadata): AssetContractExecutionMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const invocationMode = metadata.invocationMode;
  if (invocationMode && !["sync", "async", "deferred"].includes(invocationMode)) {
    throw new Error("Asset contract invocation mode must be sync, async, or deferred.");
  }

  const sideEffects = metadata.sideEffects;
  if (sideEffects && !["none", "bounded", "external"].includes(sideEffects)) {
    throw new Error("Asset contract side-effects must be none, bounded, or external.");
  }

  return Object.freeze({
    invocationMode,
    sideEffects,
  });
}

export function createAssetContractDescriptor(
  descriptor: AssetContractDescriptor,
): AssetContractDescriptor {
  const version = descriptor.version.trim();
  if (!version) {
    throw new Error("Asset contracts require a non-empty version.");
  }

  return Object.freeze({
    version,
    input: normalizeShape(descriptor.input),
    output: normalizeShape(descriptor.output),
    parameters: normalizeParameters(descriptor.parameters),
    execution: normalizeExecution(descriptor.execution),
  });
}
