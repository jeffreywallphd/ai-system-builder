import { AssetId } from "../assets/AssetId";
import type {
  AssetDraftDependencyReference,
  AssetMetadata,
  AssetProvenance,
} from "../studio-shell/StudioShellDomain";
import type { AssetContractDescriptor } from "../contracts/AssetContract";
import {
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type CompositionTaxonomyDescriptor,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";
import {
  createSystemContextWorkflowMappingConfiguration,
  type SystemContextWorkflowMappingConfiguration,
} from "./SystemContextWorkflowMappingConfiguration";

export const SystemStudioIdentity = Object.freeze({
  studioType: "system-studio",
  defaultStudioId: "studio-systems",
  defaultStudioName: "System Studio",
});

export const SystemComponentKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
});

export type SystemComponentKind = typeof SystemComponentKinds[keyof typeof SystemComponentKinds];

export interface SystemComponentReference {
  readonly componentKind: SystemComponentKind;
  readonly assetId: string;
  readonly versionId?: string;
  readonly alias?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
}

export interface SystemCompositionReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly alias?: string;
}

export interface SystemInputDefinition {
  readonly inputId: string;
  readonly description?: string;
  readonly valueType?: string;
  readonly required?: boolean;
}

export interface SystemOutputDefinition {
  readonly outputId: string;
  readonly description?: string;
  readonly valueType?: string;
}

export interface SystemParameterDefinition {
  readonly parameterId: string;
  readonly description?: string;
  readonly valueType?: string;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
}

export interface SystemExecutionMetadata {
  readonly runtime?: {
    readonly environment?: string;
    readonly requirements?: ReadonlyArray<string>;
  };
  readonly orchestration?: {
    readonly mode?: string;
    readonly hints?: ReadonlyArray<string>;
  };
  readonly publish?: {
    readonly visibility?: "private" | "team" | "public";
    readonly exportTargets?: ReadonlyArray<string>;
  };
  readonly executionProfile?: {
    readonly profileId?: string;
    readonly latencyTier?: "standard" | "low-latency" | "batch";
  };
  readonly operations?: {
    readonly ownerTeam?: string;
    readonly supportContact?: string;
    readonly notes?: string;
  };
  readonly runtimeCapabilityBindings?: {
    readonly schemaVersion?: string;
    readonly bindings?: ReadonlyArray<Record<string, unknown>>;
  };
  readonly workflowContextMapping?: SystemContextWorkflowMappingConfiguration;
}

export const SystemBindingEndpointScopes = Object.freeze({
  systemInput: "system-input",
  systemOutput: "system-output",
  systemParameter: "system-parameter",
  componentInput: "component-input",
  componentOutput: "component-output",
  componentParameter: "component-parameter",
});

export type SystemBindingEndpointScope =
  typeof SystemBindingEndpointScopes[keyof typeof SystemBindingEndpointScopes];

export interface SystemBindingEndpoint {
  readonly scope: SystemBindingEndpointScope;
  readonly endpointId: string;
  readonly componentAlias?: string;
}

export interface SystemBinding {
  readonly bindingId: string;
  readonly source: SystemBindingEndpoint;
  readonly target: SystemBindingEndpoint;
  readonly description?: string;
}

export interface SystemAsset {
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly provenance?: AssetProvenance;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly components: ReadonlyArray<SystemComponentReference>;
  readonly nestedSystems: ReadonlyArray<SystemCompositionReference>;
  readonly inputs: ReadonlyArray<SystemInputDefinition>;
  readonly outputs: ReadonlyArray<SystemOutputDefinition>;
  readonly parameters: ReadonlyArray<SystemParameterDefinition>;
  readonly bindings: ReadonlyArray<SystemBinding>;
  readonly executionMetadata?: SystemExecutionMetadata;
}

export interface SystemCompositionNode {
  readonly system: SystemAsset;
  readonly children?: ReadonlyArray<SystemCompositionNode>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createDependencyReference(assetId: string, versionId?: string): AssetDraftDependencyReference {
  return Object.freeze({
    assetId: normalizeRequired(assetId, "System dependency asset id"),
    versionId: normalizeOptional(versionId),
  });
}

function normalizeSystemComponentReference(input: SystemComponentReference): SystemComponentReference {
  const componentKind = input.componentKind;
  if (!Object.values(SystemComponentKinds).includes(componentKind)) {
    throw new Error(`System component kind '${input.componentKind}' is not supported.`);
  }

  const taxonomy = input.taxonomy ? createCompositionTaxonomyDescriptor(input.taxonomy) : undefined;
  if (taxonomy) {
    assertAllowedCompositionTaxonomyCombination(taxonomy, "System component taxonomy");
    if (componentKind === SystemComponentKinds.atomic && taxonomy.structuralKind !== TaxonomyStructuralKinds.atomic) {
      throw new Error("Atomic system components require atomic taxonomy structural kind.");
    }
    if (componentKind === SystemComponentKinds.composite && taxonomy.structuralKind !== TaxonomyStructuralKinds.composite) {
      throw new Error("Composite system components require composite taxonomy structural kind.");
    }
    if (componentKind === SystemComponentKinds.system && taxonomy.structuralKind !== TaxonomyStructuralKinds.system) {
      throw new Error("System system components require system taxonomy structural kind.");
    }
  }

  return Object.freeze({
    componentKind,
    assetId: normalizeRequired(input.assetId, "System component asset id"),
    versionId: normalizeOptional(input.versionId),
    alias: normalizeOptional(input.alias),
    taxonomy,
  });
}

function normalizeSystemInputDefinition(input: SystemInputDefinition): SystemInputDefinition {
  return Object.freeze({
    inputId: normalizeRequired(input.inputId, "System input id"),
    description: normalizeOptional(input.description),
    valueType: normalizeOptional(input.valueType),
    required: input.required ?? false,
  });
}

function normalizeSystemOutputDefinition(input: SystemOutputDefinition): SystemOutputDefinition {
  return Object.freeze({
    outputId: normalizeRequired(input.outputId, "System output id"),
    description: normalizeOptional(input.description),
    valueType: normalizeOptional(input.valueType),
  });
}

function normalizeSystemParameterDefinition(input: SystemParameterDefinition): SystemParameterDefinition {
  return Object.freeze({
    parameterId: normalizeRequired(input.parameterId, "System parameter id"),
    description: normalizeOptional(input.description),
    valueType: normalizeOptional(input.valueType),
    required: input.required ?? false,
    defaultValue: input.defaultValue,
  });
}

function normalizeSystemBindingEndpoint(input: SystemBindingEndpoint): SystemBindingEndpoint {
  if (!Object.values(SystemBindingEndpointScopes).includes(input.scope)) {
    throw new Error(`System binding endpoint scope '${input.scope}' is not supported.`);
  }

  const componentAlias = normalizeOptional(input.componentAlias);
  if (input.scope.startsWith("component-") && !componentAlias) {
    throw new Error("System component binding endpoints require a component alias.");
  }

  return Object.freeze({
    scope: input.scope,
    endpointId: normalizeRequired(input.endpointId, "System binding endpoint id"),
    componentAlias,
  });
}

function normalizeSystemBinding(input: SystemBinding): SystemBinding {
  const source = normalizeSystemBindingEndpoint(input.source);
  const target = normalizeSystemBindingEndpoint(input.target);
  if (
    source.scope === target.scope
    && source.endpointId === target.endpointId
    && source.componentAlias === target.componentAlias
  ) {
    throw new Error("System bindings must connect distinct source and target endpoints.");
  }

  return Object.freeze({
    bindingId: normalizeRequired(input.bindingId, "System binding id"),
    source,
    target,
    description: normalizeOptional(input.description),
  });
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  const normalized = [...new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeSystemExecutionMetadata(input?: SystemExecutionMetadata): SystemExecutionMetadata | undefined {
  if (!input) {
    return undefined;
  }

  const normalized: SystemExecutionMetadata = Object.freeze({
    runtime: input.runtime
      ? Object.freeze({
        environment: normalizeOptional(input.runtime.environment),
        requirements: normalizeStringList(input.runtime.requirements),
      })
      : undefined,
    orchestration: input.orchestration
      ? Object.freeze({
        mode: normalizeOptional(input.orchestration.mode),
        hints: normalizeStringList(input.orchestration.hints),
      })
      : undefined,
    publish: input.publish
      ? Object.freeze({
        visibility: input.publish.visibility,
        exportTargets: normalizeStringList(input.publish.exportTargets),
      })
      : undefined,
    executionProfile: input.executionProfile
      ? Object.freeze({
        profileId: normalizeOptional(input.executionProfile.profileId),
        latencyTier: input.executionProfile.latencyTier,
      })
      : undefined,
    operations: input.operations
      ? Object.freeze({
        ownerTeam: normalizeOptional(input.operations.ownerTeam),
        supportContact: normalizeOptional(input.operations.supportContact),
        notes: normalizeOptional(input.operations.notes),
      })
      : undefined,
    runtimeCapabilityBindings: input.runtimeCapabilityBindings
      ? Object.freeze({
        schemaVersion: normalizeOptional(input.runtimeCapabilityBindings.schemaVersion),
        bindings: Array.isArray(input.runtimeCapabilityBindings.bindings)
          ? Object.freeze(input.runtimeCapabilityBindings.bindings.map((entry) => Object.freeze({ ...(entry ?? {}) })))
          : undefined,
      })
      : undefined,
    workflowContextMapping: input.workflowContextMapping
      ? createSystemContextWorkflowMappingConfiguration(input.workflowContextMapping)
      : undefined,
  });

  const hasEntries = Boolean(
    normalized.runtime?.environment
    || normalized.runtime?.requirements?.length
    || normalized.orchestration?.mode
    || normalized.orchestration?.hints?.length
    || normalized.publish?.visibility
    || normalized.publish?.exportTargets?.length
    || normalized.executionProfile?.profileId
    || normalized.executionProfile?.latencyTier
    || normalized.operations?.ownerTeam
    || normalized.operations?.supportContact
    || normalized.operations?.notes
    || normalized.runtimeCapabilityBindings?.schemaVersion
    || normalized.runtimeCapabilityBindings?.bindings?.length
    || normalized.workflowContextMapping?.mappings?.length
  );
  return hasEntries ? normalized : undefined;
}

function normalizeSystemDependencies(dependencies?: ReadonlyArray<AssetDraftDependencyReference>): ReadonlyArray<AssetDraftDependencyReference> {
  const deduped = new Map<string, AssetDraftDependencyReference>();
  for (const dependency of dependencies ?? []) {
    const normalized = createDependencyReference(dependency.assetId, dependency.versionId);
    deduped.set(`${normalized.assetId}::${normalized.versionId ?? ""}`, normalized);
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeNestedSystemReference(input: SystemCompositionReference): SystemCompositionReference {
  return Object.freeze({
    assetId: normalizeRequired(input.assetId, "Nested system asset id"),
    versionId: normalizeOptional(input.versionId),
    alias: normalizeOptional(input.alias),
  });
}

function assertNoDuplicateIdentifiers(input: {
  readonly values: ReadonlyArray<{ readonly id: string }>;
  readonly label: string;
}): void {
  const seen = new Set<string>();
  for (const value of input.values) {
    if (seen.has(value.id)) {
      throw new Error(`${input.label} '${value.id}' must be unique.`);
    }
    seen.add(value.id);
  }
}

function assertNoDirectSelfReference(assetId: string, components: ReadonlyArray<SystemComponentReference>): void {
  if (components.some((component) => component.componentKind === SystemComponentKinds.system && component.assetId === assetId)) {
    throw new Error("System assets cannot directly reference themselves as child system components.");
  }
}

function assertNoDirectSelfNestedReference(assetId: string, nestedSystems: ReadonlyArray<SystemCompositionReference>): void {
  if (nestedSystems.some((entry) => entry.assetId === assetId)) {
    throw new Error("System assets cannot directly reference themselves as nested systems.");
  }
}

function assertNoDirectSelfDependency(assetId: string, dependencies: ReadonlyArray<AssetDraftDependencyReference>): void {
  if (dependencies.some((dependency) => dependency.assetId === assetId)) {
    throw new Error("System assets cannot directly depend on themselves.");
  }
}

function assertValidBindingEndpoints(input: {
  readonly assetId: string;
  readonly components: ReadonlyArray<SystemComponentReference>;
  readonly inputs: ReadonlyArray<SystemInputDefinition>;
  readonly outputs: ReadonlyArray<SystemOutputDefinition>;
  readonly parameters: ReadonlyArray<SystemParameterDefinition>;
  readonly bindings: ReadonlyArray<SystemBinding>;
}): void {
  const componentAliases = new Set(input.components.map((component) => component.alias).filter((value): value is string => !!value));
  const systemInputIds = new Set(input.inputs.map((entry) => entry.inputId));
  const systemOutputIds = new Set(input.outputs.map((entry) => entry.outputId));
  const systemParameterIds = new Set(input.parameters.map((entry) => entry.parameterId));

  const assertEndpoint = (endpoint: SystemBindingEndpoint, label: "source" | "target"): void => {
    if (endpoint.scope === SystemBindingEndpointScopes.systemInput && !systemInputIds.has(endpoint.endpointId)) {
      throw new Error(`System binding ${label} endpoint '${endpoint.endpointId}' is not a defined system input on '${input.assetId}'.`);
    }
    if (endpoint.scope === SystemBindingEndpointScopes.systemOutput && !systemOutputIds.has(endpoint.endpointId)) {
      throw new Error(`System binding ${label} endpoint '${endpoint.endpointId}' is not a defined system output on '${input.assetId}'.`);
    }
    if (endpoint.scope === SystemBindingEndpointScopes.systemParameter && !systemParameterIds.has(endpoint.endpointId)) {
      throw new Error(`System binding ${label} endpoint '${endpoint.endpointId}' is not a defined system parameter on '${input.assetId}'.`);
    }

    if (endpoint.scope.startsWith("component-")) {
      if (!endpoint.componentAlias || !componentAliases.has(endpoint.componentAlias)) {
        throw new Error(`System binding ${label} endpoint references unknown component alias '${endpoint.componentAlias ?? ""}'.`);
      }
    }
  };

  for (const binding of input.bindings) {
    assertEndpoint(binding.source, "source");
    assertEndpoint(binding.target, "target");
  }
}

export function createSystemStudioTaxonomy(
  semanticRole: Extract<CompositionTaxonomyDescriptor["semanticRole"], "system" | "app-template"> = TaxonomySemanticRoles.system,
  behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative" | "autonomous"> = TaxonomyBehaviorKinds.deterministic,
): CompositionTaxonomyDescriptor {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.system,
    semanticRole,
    behaviorKind,
  });
}

export function createSystemAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly semanticRole?: Extract<CompositionTaxonomyDescriptor["semanticRole"], "system" | "app-template">;
  readonly behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative" | "autonomous">;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["system", ...(input.tags ?? [])]),
    taxonomy: createSystemStudioTaxonomy(input.semanticRole, input.behaviorKind),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? SystemStudioIdentity.studioType,
    },
  });
}

export function createSystemAsset(input: {
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly provenance?: AssetProvenance;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
  readonly components?: ReadonlyArray<SystemComponentReference>;
  readonly nestedSystems?: ReadonlyArray<SystemCompositionReference>;
  readonly inputs?: ReadonlyArray<SystemInputDefinition>;
  readonly outputs?: ReadonlyArray<SystemOutputDefinition>;
  readonly parameters?: ReadonlyArray<SystemParameterDefinition>;
  readonly bindings?: ReadonlyArray<SystemBinding>;
  readonly executionMetadata?: SystemExecutionMetadata;
}): SystemAsset {
  const assetId = AssetId.from(input.assetId).value;
  const versionId = normalizeOptional(input.versionId);
  const taxonomy = input.taxonomy
    ? createCompositionTaxonomyDescriptor(input.taxonomy)
    : createSystemStudioTaxonomy();
  assertAllowedCompositionTaxonomyCombination(taxonomy, "System asset taxonomy");
  if (taxonomy.structuralKind !== TaxonomyStructuralKinds.system) {
    throw new Error("System assets require taxonomy structural kind 'system'.");
  }

  const components = Object.freeze((input.components ?? []).map(normalizeSystemComponentReference));
  assertNoDirectSelfReference(assetId, components);

  const nestedSystems = Object.freeze((input.nestedSystems ?? []).map(normalizeNestedSystemReference));
  assertNoDirectSelfNestedReference(assetId, nestedSystems);

  const dependencies = normalizeSystemDependencies(input.dependencies);
  assertNoDirectSelfDependency(assetId, dependencies);

  const inputs = Object.freeze((input.inputs ?? []).map(normalizeSystemInputDefinition));
  const outputs = Object.freeze((input.outputs ?? []).map(normalizeSystemOutputDefinition));
  const parameters = Object.freeze((input.parameters ?? []).map(normalizeSystemParameterDefinition));
  const bindings = Object.freeze((input.bindings ?? []).map(normalizeSystemBinding));

  assertNoDuplicateIdentifiers({ values: inputs.map((entry) => ({ id: entry.inputId })), label: "System input id" });
  assertNoDuplicateIdentifiers({ values: outputs.map((entry) => ({ id: entry.outputId })), label: "System output id" });
  assertNoDuplicateIdentifiers({ values: parameters.map((entry) => ({ id: entry.parameterId })), label: "System parameter id" });
  assertValidBindingEndpoints({ assetId, components, inputs, outputs, parameters, bindings });

  return Object.freeze({
    assetId,
    versionId,
    taxonomy,
    provenance: input.provenance,
    dependencies,
    components,
    nestedSystems,
    inputs,
    outputs,
    parameters,
    bindings,
    executionMetadata: normalizeSystemExecutionMetadata(input.executionMetadata),
  });
}

export function buildNestedSystemReferences(system: SystemAsset): ReadonlyArray<SystemCompositionReference> {
  const explicitNested = system.nestedSystems;
  const componentNested = system.components
    .filter((component) => component.componentKind === SystemComponentKinds.system)
    .map((component) => Object.freeze({
      assetId: component.assetId,
      versionId: component.versionId,
      alias: component.alias,
    }));

  const deduped = new Map<string, SystemCompositionReference>();
  for (const reference of [...explicitNested, ...componentNested]) {
    deduped.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
  }

  return Object.freeze([...deduped.values()]);
}

export function collectSystemDirectDependencies(system: SystemAsset): ReadonlyArray<AssetDraftDependencyReference> {
  const deduped = new Map<string, AssetDraftDependencyReference>();

  for (const dependency of system.dependencies) {
    deduped.set(`${dependency.assetId}::${dependency.versionId ?? ""}`, dependency);
  }

  for (const component of system.components) {
    const reference = createDependencyReference(component.assetId, component.versionId);
    deduped.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
  }

  for (const nested of system.nestedSystems) {
    const reference = createDependencyReference(nested.assetId, nested.versionId);
    deduped.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
  }

  for (const dependency of collectSystemBindingImpliedDependencies(system)) {
    deduped.set(`${dependency.assetId}::${dependency.versionId ?? ""}`, dependency);
  }

  return Object.freeze([...deduped.values()]);
}

export function collectSystemBindingImpliedDependencies(system: SystemAsset): ReadonlyArray<AssetDraftDependencyReference> {
  const componentsByAlias = new Map<string, SystemComponentReference>();
  for (const component of system.components) {
    if (component.alias) {
      componentsByAlias.set(component.alias, component);
    }
  }

  const dependencies = new Map<string, AssetDraftDependencyReference>();
  const addEndpointDependency = (endpoint: SystemBindingEndpoint): void => {
    if (!endpoint.scope.startsWith("component-")) {
      return;
    }
    const componentAlias = endpoint.componentAlias?.trim();
    if (!componentAlias) {
      return;
    }
    const component = componentsByAlias.get(componentAlias);
    if (!component) {
      return;
    }
    const reference = createDependencyReference(component.assetId, component.versionId);
    dependencies.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
  };

  for (const binding of system.bindings) {
    addEndpointDependency(binding.source);
    addEndpointDependency(binding.target);
  }

  return Object.freeze([...dependencies.values()]);
}

export async function aggregateSystemDependencies(input: {
  readonly root: SystemAsset;
  readonly resolveSystem: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined> | SystemAsset | undefined;
  readonly maxDepth?: number;
}): Promise<{
  readonly rootSystemId: string;
  readonly rootSystemVersionId?: string;
  readonly directDependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly transitiveDependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly allDependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly traversedSystemIds: ReadonlyArray<string>;
  readonly maxDepth: number;
}> {
  const maxDepth = Math.max(1, input.maxDepth ?? 4);
  const rootKey = `${input.root.assetId}::${input.root.versionId ?? ""}`;
  const direct = new Map<string, AssetDraftDependencyReference>();
  const transitive = new Map<string, AssetDraftDependencyReference>();
  const traversed = new Set<string>();

  const traverse = async (system: SystemAsset, path: ReadonlyArray<string>, depth: number): Promise<void> => {
    const key = `${system.assetId}::${system.versionId ?? ""}`;
    if (path.includes(key)) {
      throw new Error(`System dependency cycle detected at '${system.assetId}'.`);
    }

    if (depth > maxDepth) {
      throw new Error(`System dependency traversal exceeds max depth of ${maxDepth}.`);
    }

    traversed.add(system.assetId);

    const dependencies = collectSystemDirectDependencies(system);
    for (const dependency of dependencies) {
      const depKey = `${dependency.assetId}::${dependency.versionId ?? ""}`;
      if (key === rootKey) {
        direct.set(depKey, dependency);
      } else {
        transitive.set(depKey, dependency);
      }
    }

    for (const reference of buildNestedSystemReferences(system)) {
      const child = await input.resolveSystem(reference);
      if (!child) {
        continue;
      }
      await traverse(child, [...path, key], depth + 1);
    }
  };

  await traverse(input.root, [], 1);

  const directKeys = new Set(direct.keys());
  for (const key of [...transitive.keys()]) {
    if (directKeys.has(key)) {
      transitive.delete(key);
    }
  }

  return Object.freeze({
    rootSystemId: input.root.assetId,
    rootSystemVersionId: input.root.versionId,
    directDependencies: Object.freeze([...direct.values()]),
    transitiveDependencies: Object.freeze([...transitive.values()]),
    allDependencies: Object.freeze([...direct.values(), ...transitive.values()]),
    traversedSystemIds: Object.freeze([...traversed]),
    maxDepth,
  });
}

export function assertBoundedSystemComposition(input: {
  readonly root: SystemCompositionNode;
  readonly maxDepth?: number;
}): void {
  const maxDepth = Math.max(1, input.maxDepth ?? 4);
  const traverse = (node: SystemCompositionNode, path: ReadonlyArray<string>): void => {
    const currentId = node.system.assetId;
    if (path.includes(currentId)) {
      throw new Error(`System composition cycle detected at '${currentId}'.`);
    }

    const nextPath = [...path, currentId];
    if (nextPath.length > maxDepth) {
      throw new Error(`System composition exceeds max depth of ${maxDepth}.`);
    }

    for (const child of node.children ?? []) {
      traverse(child, nextPath);
    }
  };

  traverse(input.root, []);
}
