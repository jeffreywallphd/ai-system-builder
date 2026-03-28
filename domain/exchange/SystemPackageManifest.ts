import type { AssetContractDescriptor } from "../contracts/AssetContract";
import { createAssetContractDescriptor } from "../contracts/AssetContract";
import { AssetId } from "../assets/AssetId";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import {
  TaxonomyStructuralKinds,
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
} from "../taxonomy/CompositionTaxonomy";
import type { ExchangeBundleProvenance } from "./ExchangeBundleDomain";
import { ExchangeBundleFormatVersion } from "./ExchangeBundleDomain";
import {
  SystemComponentKinds,
  assertBoundedSystemComposition,
  buildNestedSystemReferences,
  type SystemAsset,
  type SystemComponentReference,
  type SystemCompositionNode,
  type SystemCompositionReference,
} from "../system-studio/SystemAssetDomain";

export const SystemPackageManifestNodeKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
});

export type SystemPackageManifestNodeKind =
  typeof SystemPackageManifestNodeKinds[keyof typeof SystemPackageManifestNodeKinds];

export const SystemPackageManifestEdgeKinds = Object.freeze({
  component: "component",
  nestedSystem: "nested-system",
});

export type SystemPackageManifestEdgeKind =
  typeof SystemPackageManifestEdgeKinds[keyof typeof SystemPackageManifestEdgeKinds];

export interface SystemPackageManifestSubject {
  readonly assetId: string;
  readonly versionId: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
}

export interface SystemPackageManifestNode {
  readonly nodeId: string;
  readonly kind: SystemPackageManifestNodeKind;
  readonly assetId: string;
  readonly versionId: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly interface?: Readonly<{
    readonly inputs: ReadonlyArray<string>;
    readonly outputs: ReadonlyArray<string>;
    readonly parameters: ReadonlyArray<string>;
    readonly bindings: ReadonlyArray<string>;
  }>;
  readonly capabilityHints: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
}

export interface SystemPackageManifestEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeKind: SystemPackageManifestEdgeKind;
  readonly relationRole?: string;
  readonly alias?: string;
}

export interface SystemPackageCompositionReference {
  readonly parentAssetId: string;
  readonly parentVersionId: string;
  readonly childAssetId: string;
  readonly childVersionId: string;
  readonly childKind: SystemPackageManifestNodeKind;
  readonly edgeKind: SystemPackageManifestEdgeKind;
  readonly alias?: string;
}

export interface SystemPackageManifestMetadata {
  readonly createdAt: string;
  readonly deterministicInputKey?: string;
  readonly packageLabel?: string;
  readonly tags: ReadonlyArray<string>;
  readonly dependencySnapshotHook?: string;
  readonly provenance?: ExchangeBundleProvenance;
}

export interface SystemPackageManifest {
  readonly manifestVersion: "ai-loom.system-package-manifest.v1";
  readonly bundleFormatVersion: string;
  readonly subject: SystemPackageManifestSubject;
  readonly metadata: SystemPackageManifestMetadata;
  readonly nodes: ReadonlyArray<SystemPackageManifestNode>;
  readonly edges: ReadonlyArray<SystemPackageManifestEdge>;
  readonly composition: ReadonlyArray<SystemPackageCompositionReference>;
  readonly scope: {
    readonly excludesRuntimeState: true;
    readonly excludesDeploymentState: true;
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
}

function normalizeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!record) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(record)) as Record<string, unknown>);
}

function normalizeProvenance(input?: ExchangeBundleProvenance): ExchangeBundleProvenance | undefined {
  if (!input) {
    return undefined;
  }

  return Object.freeze({
    originType: input.originType,
    sourceBundleId: normalizeOptional(input.sourceBundleId),
    sourceVersionLineage: normalizeStringArray(input.sourceVersionLineage),
    handoffSessionId: normalizeOptional(input.handoffSessionId),
    metadata: normalizeRecord(input.metadata),
  });
}

function toNodeId(assetId: string, versionId: string): string {
  return `${assetId}@${versionId}`;
}

function assertPinnedVersion(versionId: string | undefined, label: string): string {
  const normalized = normalizeOptional(versionId);
  if (!normalized) {
    throw new Error(`${label} must be version-pinned for portable system packaging.`);
  }
  return normalized;
}

function nodeKindFromSystemComponentKind(kind: SystemComponentReference["componentKind"]): SystemPackageManifestNodeKind {
  if (kind === SystemComponentKinds.atomic) {
    return SystemPackageManifestNodeKinds.atomic;
  }
  if (kind === SystemComponentKinds.composite) {
    return SystemPackageManifestNodeKinds.composite;
  }
  return SystemPackageManifestNodeKinds.system;
}

function createSystemNode(system: SystemAsset): SystemPackageManifestNode {
  const versionId = assertPinnedVersion(system.versionId, `System '${system.assetId}' version`);
  return Object.freeze({
    nodeId: toNodeId(system.assetId, versionId),
    kind: SystemPackageManifestNodeKinds.system,
    assetId: AssetId.from(system.assetId).value,
    versionId,
    taxonomy: createCompositionTaxonomyDescriptor(system.taxonomy),
    interface: Object.freeze({
      inputs: Object.freeze(system.inputs.map((entry) => entry.inputId).sort((a, b) => a.localeCompare(b))),
      outputs: Object.freeze(system.outputs.map((entry) => entry.outputId).sort((a, b) => a.localeCompare(b))),
      parameters: Object.freeze(system.parameters.map((entry) => entry.parameterId).sort((a, b) => a.localeCompare(b))),
      bindings: Object.freeze(system.bindings.map((entry) => entry.bindingId).sort((a, b) => a.localeCompare(b))),
    }),
    capabilityHints: normalizeStringArray([
      ...(system.executionMetadata?.runtime?.requirements ?? []),
      ...(system.executionMetadata?.orchestration?.hints ?? []),
    ]),
    configurationHints: normalizeRecord(system.executionMetadata ? { executionMetadata: system.executionMetadata } : undefined),
  });
}

function createSystemChildNode(reference: SystemCompositionReference): SystemPackageManifestNode {
  const assetId = AssetId.from(reference.assetId).value;
  const versionId = assertPinnedVersion(reference.versionId, `Nested system '${assetId}' version`);
  return Object.freeze({
    nodeId: toNodeId(assetId, versionId),
    kind: SystemPackageManifestNodeKinds.system,
    assetId,
    versionId,
    capabilityHints: Object.freeze([]),
  });
}

function createComponentNode(reference: SystemComponentReference): SystemPackageManifestNode {
  const assetId = AssetId.from(reference.assetId).value;
  const versionId = assertPinnedVersion(reference.versionId, `System component '${assetId}' version`);
  return Object.freeze({
    nodeId: toNodeId(assetId, versionId),
    kind: nodeKindFromSystemComponentKind(reference.componentKind),
    assetId,
    versionId,
    taxonomy: reference.taxonomy ? createCompositionTaxonomyDescriptor(reference.taxonomy) : undefined,
    capabilityHints: Object.freeze([]),
  });
}

export function createSystemPackageManifest(input: {
  readonly root: SystemCompositionNode;
  readonly bundleFormatVersion?: string;
  readonly metadata?: Partial<Omit<SystemPackageManifestMetadata, "provenance">>;
  readonly provenance?: ExchangeBundleProvenance;
  readonly rootContract?: AssetContractDescriptor;
  readonly maxDepth?: number;
}): SystemPackageManifest {
  assertBoundedSystemComposition({ root: input.root, maxDepth: input.maxDepth });

  const rootSystem = input.root.system;
  const rootAssetId = AssetId.from(rootSystem.assetId).value;
  const rootVersionId = assertPinnedVersion(rootSystem.versionId, "Root system version");
  const rootTaxonomy = createCompositionTaxonomyDescriptor(rootSystem.taxonomy);
  assertAllowedCompositionTaxonomyCombination(rootTaxonomy, "System package taxonomy");
  if (rootTaxonomy.structuralKind !== TaxonomyStructuralKinds.system) {
    throw new Error("System package manifests require root taxonomy structural kind 'system'.");
  }

  const nodes = new Map<string, SystemPackageManifestNode>();
  const edges = new Map<string, SystemPackageManifestEdge>();
  const compositionReferences = new Map<string, SystemPackageCompositionReference>();

  const upsertNode = (node: SystemPackageManifestNode): void => {
    const existing = nodes.get(node.nodeId);
    if (!existing) {
      nodes.set(node.nodeId, node);
      return;
    }
    if (existing.kind !== SystemPackageManifestNodeKinds.system && node.kind === SystemPackageManifestNodeKinds.system) {
      nodes.set(node.nodeId, node);
      return;
    }
    if (!existing.taxonomy && node.taxonomy) {
      nodes.set(node.nodeId, Object.freeze({ ...existing, taxonomy: node.taxonomy }));
    }
  };

  const addEdge = (edge: SystemPackageManifestEdge): void => {
    const key = `${edge.fromNodeId}->${edge.toNodeId}:${edge.edgeKind}:${edge.relationRole ?? ""}:${edge.alias ?? ""}`;
    edges.set(key, edge);
  };

  const addCompositionReference = (reference: SystemPackageCompositionReference): void => {
    const key = `${reference.parentAssetId}@${reference.parentVersionId}->${reference.childAssetId}@${reference.childVersionId}:${reference.edgeKind}:${reference.childKind}:${reference.alias ?? ""}`;
    compositionReferences.set(key, reference);
  };

  const visit = (node: SystemCompositionNode): void => {
    const parent = createSystemNode(node.system);
    upsertNode(parent);

    const sortedComponents = [...node.system.components].sort((left, right) =>
      `${left.alias ?? ""}:${left.componentKind}:${left.assetId}:${left.versionId ?? ""}`.localeCompare(
        `${right.alias ?? ""}:${right.componentKind}:${right.assetId}:${right.versionId ?? ""}`,
      ));

    for (const component of sortedComponents) {
      const componentNode = createComponentNode(component);
      upsertNode(componentNode);
      addEdge(Object.freeze({
        fromNodeId: parent.nodeId,
        toNodeId: componentNode.nodeId,
        edgeKind: SystemPackageManifestEdgeKinds.component,
        relationRole: component.componentKind,
        alias: normalizeOptional(component.alias),
      }));
      addCompositionReference(Object.freeze({
        parentAssetId: parent.assetId,
        parentVersionId: parent.versionId,
        childAssetId: componentNode.assetId,
        childVersionId: componentNode.versionId,
        childKind: componentNode.kind,
        edgeKind: SystemPackageManifestEdgeKinds.component,
        alias: normalizeOptional(component.alias),
      }));
    }

    const nestedSystems = [...buildNestedSystemReferences(node.system)].sort((left, right) =>
      `${left.alias ?? ""}:${left.assetId}:${left.versionId ?? ""}`.localeCompare(`${right.alias ?? ""}:${right.assetId}:${right.versionId ?? ""}`));
    for (const nested of nestedSystems) {
      const nestedNode = createSystemChildNode(nested);
      upsertNode(nestedNode);
      addEdge(Object.freeze({
        fromNodeId: parent.nodeId,
        toNodeId: nestedNode.nodeId,
        edgeKind: SystemPackageManifestEdgeKinds.nestedSystem,
        relationRole: SystemComponentKinds.system,
        alias: normalizeOptional(nested.alias),
      }));
      addCompositionReference(Object.freeze({
        parentAssetId: parent.assetId,
        parentVersionId: parent.versionId,
        childAssetId: nestedNode.assetId,
        childVersionId: nestedNode.versionId,
        childKind: SystemPackageManifestNodeKinds.system,
        edgeKind: SystemPackageManifestEdgeKinds.nestedSystem,
        alias: normalizeOptional(nested.alias),
      }));
    }

    const sortedChildren = [...(node.children ?? [])].sort((left, right) =>
      `${left.system.assetId}:${left.system.versionId ?? ""}`.localeCompare(`${right.system.assetId}:${right.system.versionId ?? ""}`));
    for (const child of sortedChildren) {
      visit(child);
    }
  };

  visit(input.root);

  const subject: SystemPackageManifestSubject = Object.freeze({
    assetId: rootAssetId,
    versionId: rootVersionId,
    taxonomy: rootTaxonomy,
  });

  const manifestNodes = Object.freeze([...nodes.values()].sort((left, right) =>
    `${left.kind}:${left.assetId}:${left.versionId}`.localeCompare(`${right.kind}:${right.assetId}:${right.versionId}`)));
  const manifestEdges = Object.freeze([...edges.values()].sort((left, right) =>
    `${left.edgeKind}:${left.fromNodeId}:${left.toNodeId}:${left.relationRole ?? ""}:${left.alias ?? ""}`
      .localeCompare(`${right.edgeKind}:${right.fromNodeId}:${right.toNodeId}:${right.relationRole ?? ""}:${right.alias ?? ""}`)));
  const manifestComposition = Object.freeze([...compositionReferences.values()].sort((left, right) =>
    `${left.parentAssetId}:${left.parentVersionId}:${left.edgeKind}:${left.childKind}:${left.childAssetId}:${left.childVersionId}:${left.alias ?? ""}`
      .localeCompare(`${right.parentAssetId}:${right.parentVersionId}:${right.edgeKind}:${right.childKind}:${right.childAssetId}:${right.childVersionId}:${right.alias ?? ""}`)));

  return Object.freeze({
    manifestVersion: "ai-loom.system-package-manifest.v1",
    bundleFormatVersion: ExchangeBundleFormatVersion.from(input.bundleFormatVersion).value,
    subject,
    metadata: Object.freeze({
      createdAt: normalizeOptional(input.metadata?.createdAt) ?? new Date().toISOString(),
      deterministicInputKey: normalizeOptional(input.metadata?.deterministicInputKey),
      packageLabel: normalizeOptional(input.metadata?.packageLabel),
      tags: normalizeStringArray(input.metadata?.tags),
      dependencySnapshotHook: normalizeOptional(input.metadata?.dependencySnapshotHook),
      provenance: normalizeProvenance(input.provenance),
    }),
    nodes: manifestNodes.map((entry) => {
      if (entry.nodeId === toNodeId(rootAssetId, rootVersionId) && input.rootContract) {
        return Object.freeze({ ...entry, contract: createAssetContractDescriptor(input.rootContract) });
      }
      return entry;
    }),
    edges: manifestEdges,
    composition: manifestComposition,
    scope: Object.freeze({
      excludesRuntimeState: true,
      excludesDeploymentState: true,
    }),
  });
}
