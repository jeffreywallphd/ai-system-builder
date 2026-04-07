import type {
  AssetContractDescriptor,
  AssetContractParameterDescriptor,
  AssetContractShapeDescriptor,
} from "@domain/contracts/AssetContract";
import {
  buildNestedSystemReferences,
  type SystemAsset,
  type SystemComponentReference,
  type SystemCompositionReference,
} from "@domain/system-studio/SystemAssetDomain";

export const RuntimeExecutionInterfaceKinds = Object.freeze({
  systemInput: "system-input",
  systemOutput: "system-output",
  systemParameter: "system-parameter",
  contractParameter: "contract-parameter",
});

export type RuntimeExecutionInterfaceKind =
  typeof RuntimeExecutionInterfaceKinds[keyof typeof RuntimeExecutionInterfaceKinds];

export interface RuntimeExecutionInput {
  readonly id: string;
  readonly required: boolean;
  readonly valueType?: string;
  readonly description?: string;
  readonly source: Extract<RuntimeExecutionInterfaceKind, "system-input">;
}

export interface RuntimeExecutionOutput {
  readonly id: string;
  readonly valueType?: string;
  readonly description?: string;
  readonly source: Extract<RuntimeExecutionInterfaceKind, "system-output">;
}

export interface RuntimeExecutionParameter {
  readonly id: string;
  readonly required: boolean;
  readonly valueType?: string;
  readonly description?: string;
  readonly defaultValue?: unknown;
  readonly source: Exclude<RuntimeExecutionInterfaceKind, "system-input" | "system-output">;
}

export interface RuntimeChildComponentInterfaceReference {
  readonly alias?: string;
  readonly componentKind: SystemComponentReference["componentKind"];
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy?: SystemComponentReference["taxonomy"];
  readonly contractVersion?: string;
  readonly inputs: ReadonlyArray<string>;
  readonly outputs: ReadonlyArray<string>;
  readonly parameters: ReadonlyArray<string>;
}

export interface RuntimeExecutionContract {
  readonly systemAssetId: string;
  readonly systemVersionId?: string;
  readonly taxonomy: SystemAsset["taxonomy"];
  readonly sourceContractVersion: string;
  readonly inputs: ReadonlyArray<RuntimeExecutionInput>;
  readonly outputs: ReadonlyArray<RuntimeExecutionOutput>;
  readonly parameters: ReadonlyArray<RuntimeExecutionParameter>;
  readonly childInterfaces: ReadonlyArray<RuntimeChildComponentInterfaceReference>;
  readonly recursion: {
    readonly maxDepth: number;
    readonly status: "complete" | "cycle-detected" | "max-depth-exceeded";
    readonly nestedSystemCount: number;
    readonly unresolvedNestedSystemCount: number;
  };
}

function inferRequiredIds(shape?: AssetContractShapeDescriptor): ReadonlySet<string> {
  const schema = shape?.schema as { readonly required?: ReadonlyArray<string> } | undefined;
  return new Set((schema?.required ?? []).map((entry) => entry.trim()).filter(Boolean));
}

function inferShapeProperties(shape?: AssetContractShapeDescriptor): Readonly<Record<string, { readonly type?: string; readonly description?: string }>> {
  const schema = shape?.schema as {
    readonly properties?: Record<string, { readonly type?: string; readonly description?: string }>;
  } | undefined;
  return Object.freeze(schema?.properties ?? {});
}

function buildParameterMap(parameters: ReadonlyArray<AssetContractParameterDescriptor>): ReadonlyMap<string, AssetContractParameterDescriptor> {
  return new Map(parameters.map((entry) => [entry.id, entry]));
}

function trimOrUndefined(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function mapComponentInterfaceReference(input: {
  readonly component: SystemComponentReference;
  readonly contract?: AssetContractDescriptor;
}): RuntimeChildComponentInterfaceReference {
  const propertiesFromInput = inferShapeProperties(input.contract?.input);
  const propertiesFromOutput = inferShapeProperties(input.contract?.output);

  return Object.freeze({
    alias: trimOrUndefined(input.component.alias),
    componentKind: input.component.componentKind,
    assetId: input.component.assetId,
    versionId: trimOrUndefined(input.component.versionId),
    taxonomy: input.component.taxonomy,
    contractVersion: input.contract?.version,
    inputs: Object.freeze(Object.keys(propertiesFromInput).sort((left, right) => left.localeCompare(right))),
    outputs: Object.freeze(Object.keys(propertiesFromOutput).sort((left, right) => left.localeCompare(right))),
    parameters: Object.freeze(input.contract?.parameters.map((entry) => entry.id).sort((left, right) => left.localeCompare(right)) ?? []),
  });
}

export async function mapSystemContractToRuntimeExecutionContract(input: {
  readonly root: SystemAsset;
  readonly contract: AssetContractDescriptor;
  readonly resolveSystem?: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined> | SystemAsset | undefined;
  readonly resolveChildContract?: (component: SystemComponentReference) => Promise<AssetContractDescriptor | undefined> | AssetContractDescriptor | undefined;
  readonly maxDepth?: number;
}): Promise<RuntimeExecutionContract> {
  if (input.root.taxonomy.structuralKind !== "system") {
    throw new Error("Runtime execution contract mapping requires a system taxonomy root.");
  }

  const maxDepth = Math.max(1, input.maxDepth ?? 4);
  const contractInputProperties = inferShapeProperties(input.contract.input);
  const contractOutputProperties = inferShapeProperties(input.contract.output);
  const contractRequiredInputIds = inferRequiredIds(input.contract.input);
  const contractParametersById = buildParameterMap(input.contract.parameters);

  const inputs = Object.freeze(input.root.inputs
    .map((entry) => {
      const fromContract = contractInputProperties[entry.inputId];
      return Object.freeze({
        id: entry.inputId,
        required: entry.required ?? contractRequiredInputIds.has(entry.inputId),
        valueType: trimOrUndefined(entry.valueType) ?? trimOrUndefined(fromContract?.type),
        description: trimOrUndefined(entry.description) ?? trimOrUndefined(fromContract?.description),
        source: RuntimeExecutionInterfaceKinds.systemInput,
      } satisfies RuntimeExecutionInput);
    })
    .sort((left, right) => left.id.localeCompare(right.id)));

  const outputs = Object.freeze(input.root.outputs
    .map((entry) => {
      const fromContract = contractOutputProperties[entry.outputId];
      return Object.freeze({
        id: entry.outputId,
        valueType: trimOrUndefined(entry.valueType) ?? trimOrUndefined(fromContract?.type),
        description: trimOrUndefined(entry.description) ?? trimOrUndefined(fromContract?.description),
        source: RuntimeExecutionInterfaceKinds.systemOutput,
      } satisfies RuntimeExecutionOutput);
    })
    .sort((left, right) => left.id.localeCompare(right.id)));

  const systemParameters = input.root.parameters.map((entry) => {
    const contractParameter = contractParametersById.get(`systemParameter:${entry.parameterId}`) ?? contractParametersById.get(entry.parameterId);
    return Object.freeze({
      id: entry.parameterId,
      required: entry.required ?? contractParameter?.required ?? false,
      valueType: trimOrUndefined(entry.valueType) ?? trimOrUndefined(contractParameter?.valueType),
      description: trimOrUndefined(entry.description) ?? trimOrUndefined(contractParameter?.description),
      defaultValue: entry.defaultValue ?? contractParameter?.defaultValue,
      source: RuntimeExecutionInterfaceKinds.systemParameter,
    } satisfies RuntimeExecutionParameter);
  });

  const contractOnlyParameters = input.contract.parameters
    .filter((entry) => !entry.id.startsWith("systemParameter:"))
    .map((entry) => Object.freeze({
      id: entry.id,
      required: entry.required,
      valueType: trimOrUndefined(entry.valueType),
      description: trimOrUndefined(entry.description),
      defaultValue: entry.defaultValue,
      source: RuntimeExecutionInterfaceKinds.contractParameter,
    } satisfies RuntimeExecutionParameter));

  const parameters = Object.freeze([
    ...systemParameters,
    ...contractOnlyParameters,
  ].sort((left, right) => left.id.localeCompare(right.id)));

  const childInterfaces = Object.freeze((await Promise.all(input.root.components.map(async (component) => {
    const contract = input.resolveChildContract ? await input.resolveChildContract(component) : undefined;
    return mapComponentInterfaceReference({ component, contract });
  }))).sort((left, right) => (
    `${left.alias ?? left.assetId}:${left.versionId ?? ""}`.localeCompare(`${right.alias ?? right.assetId}:${right.versionId ?? ""}`)
  )));

  let unresolvedNestedSystemCount = 0;
  let nestedSystemCount = 0;
  let status: RuntimeExecutionContract["recursion"]["status"] = "complete";

  if (input.resolveSystem) {
    const visitedInPath = new Set<string>();

    const traverse = async (system: SystemAsset, depth: number): Promise<void> => {
      const key = `${system.assetId}::${system.versionId ?? ""}`;
      if (visitedInPath.has(key)) {
        status = "cycle-detected";
        return;
      }
      if (depth > maxDepth) {
        status = "max-depth-exceeded";
        return;
      }

      visitedInPath.add(key);
      const nested = buildNestedSystemReferences(system)
        .sort((left, right) => `${left.assetId}:${left.versionId ?? ""}`.localeCompare(`${right.assetId}:${right.versionId ?? ""}`));
      for (const reference of nested) {
        const child = await input.resolveSystem!(reference);
        if (!child) {
          unresolvedNestedSystemCount += 1;
          continue;
        }
        nestedSystemCount += 1;
        await traverse(child, depth + 1);
      }
      visitedInPath.delete(key);
    };

    await traverse(input.root, 1);
  }

  return Object.freeze({
    systemAssetId: input.root.assetId,
    systemVersionId: trimOrUndefined(input.root.versionId),
    taxonomy: input.root.taxonomy,
    sourceContractVersion: input.contract.version,
    inputs,
    outputs,
    parameters,
    childInterfaces,
    recursion: Object.freeze({
      maxDepth,
      status,
      nestedSystemCount,
      unresolvedNestedSystemCount,
    }),
  });
}

