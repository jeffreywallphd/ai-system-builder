import { AssetId } from "../assets/AssetId";
import type { AssetDraftDependencyReference, AssetProvenance } from "../studio-shell/StudioShellDomain";
import {
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type CompositionTaxonomyDescriptor,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";

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

export interface SystemBindingReference {
  readonly bindingId: string;
  readonly sourceComponentAlias?: string;
  readonly targetComponentAlias?: string;
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
  readonly bindings: ReadonlyArray<SystemBindingReference>;
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

function normalizeSystemBinding(input: SystemBindingReference): SystemBindingReference {
  return Object.freeze({
    bindingId: normalizeRequired(input.bindingId, "System binding id"),
    sourceComponentAlias: normalizeOptional(input.sourceComponentAlias),
    targetComponentAlias: normalizeOptional(input.targetComponentAlias),
    description: normalizeOptional(input.description),
  });
}

function normalizeSystemDependencies(dependencies?: ReadonlyArray<AssetDraftDependencyReference>): ReadonlyArray<AssetDraftDependencyReference> {
  const deduped = new Map<string, AssetDraftDependencyReference>();
  for (const dependency of dependencies ?? []) {
    const assetId = normalizeRequired(dependency.assetId, "System dependency asset id");
    const versionId = normalizeOptional(dependency.versionId);
    deduped.set(`${assetId}::${versionId ?? ""}`, Object.freeze({ assetId, versionId }));
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

function assertNoDirectSelfReference(assetId: string, components: ReadonlyArray<SystemComponentReference>): void {
  if (components.some((component) => component.componentKind === SystemComponentKinds.system && component.assetId === assetId)) {
    throw new Error("System assets cannot directly reference themselves as child system components.");
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

export function createSystemAsset(input: {
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly provenance?: AssetProvenance;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
  readonly components?: ReadonlyArray<SystemComponentReference>;
  readonly nestedSystems?: ReadonlyArray<SystemCompositionReference>;
  readonly bindings?: ReadonlyArray<SystemBindingReference>;
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

  const nestedSystems = Object.freeze((input.nestedSystems ?? [])
    .map(normalizeNestedSystemReference)
    .filter((entry) => entry.assetId !== assetId));
  const bindings = Object.freeze((input.bindings ?? []).map(normalizeSystemBinding));

  return Object.freeze({
    assetId,
    versionId,
    taxonomy,
    provenance: input.provenance,
    dependencies: normalizeSystemDependencies(input.dependencies),
    components,
    nestedSystems,
    bindings,
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
