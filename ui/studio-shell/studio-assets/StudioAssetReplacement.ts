import { type StudioAssetCompositionNode, type StudioAssetCompositionValidationIssue } from "./StudioAssetComposition";
import type { StudioAssetRegistry } from "./StudioAssetRegistry";
import { resolveStudioAssetDefaultConfig } from "./StudioAssetDefaults";
import { updateStudioAssetConfigByField } from "./StudioAssetPropertySchema";

export const StudioAssetReplacementFailureKinds = Object.freeze({
  unknownNode: "unknown-node",
  unknownAsset: "unknown-asset",
  incompatibleAsset: "incompatible-asset",
  invalidByValidation: "invalid-by-validation",
});

export type StudioAssetReplacementFailureKind =
  typeof StudioAssetReplacementFailureKinds[keyof typeof StudioAssetReplacementFailureKinds];

export interface StudioAssetReplacementCandidate {
  readonly assetId: string;
  readonly title: string;
  readonly description?: string;
  readonly compatible: boolean;
  readonly reason?: string;
}

export type StudioAssetReplacementResult =
  | {
    readonly ok: true;
    readonly root: StudioAssetCompositionNode;
    readonly replacedNode: StudioAssetCompositionNode;
  }
  | {
    readonly ok: false;
    readonly kind: StudioAssetReplacementFailureKind;
    readonly message: string;
    readonly issues?: ReadonlyArray<StudioAssetCompositionValidationIssue>;
  };

interface NodeLocation {
  readonly node: StudioAssetCompositionNode;
  readonly parent?: StudioAssetCompositionNode;
}

function collectChildren(node: StudioAssetCompositionNode): ReadonlyArray<StudioAssetCompositionNode> {
  return Object.freeze([
    ...(node.slots ?? []).flatMap((placement) => placement.children),
    ...(node.regions ?? []).flatMap((placement) => placement.children),
  ]);
}

function findNodeAndParent(input: {
  readonly root: StudioAssetCompositionNode;
  readonly nodeId: string;
  readonly parent?: StudioAssetCompositionNode;
}): NodeLocation | undefined {
  if (input.root.nodeId === input.nodeId) {
    return Object.freeze({ node: input.root, parent: input.parent });
  }

  for (const child of collectChildren(input.root)) {
    const resolved = findNodeAndParent({
      root: child,
      nodeId: input.nodeId,
      parent: input.root,
    });
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function getValueAtPath(config: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, config);
}

function listSchemaFieldPaths(node: StudioAssetCompositionNode, registry: StudioAssetRegistry): ReadonlyArray<string> {
  const registration = registry.getById(node.assetId);
  const propertySchema = registration?.contract.propsSchema.propertySchema;
  if (!propertySchema) {
    return Object.freeze([]);
  }
  return Object.freeze(propertySchema.sections.flatMap((section) => section.fields.map((field) => field.path)));
}

function mergeReplacementConfig(input: {
  readonly registry: StudioAssetRegistry;
  readonly currentNode: StudioAssetCompositionNode;
  readonly targetAssetId: string;
  readonly overrideConfig?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  const replacementRegistration = input.registry.getById(input.targetAssetId);
  if (!replacementRegistration) {
    return Object.freeze({ ...(input.overrideConfig ?? {}) });
  }

  let nextConfig = resolveStudioAssetDefaultConfig({
    registration: replacementRegistration,
  });

  const currentConfig = input.currentNode.config ?? Object.freeze({});
  for (const path of listSchemaFieldPaths({ ...input.currentNode, assetId: replacementRegistration.id }, input.registry)) {
    const value = getValueAtPath(currentConfig, path);
    if (value !== undefined) {
      nextConfig = updateStudioAssetConfigByField({
        config: nextConfig,
        fieldPath: path,
        value,
      });
    }
  }

  for (const [key, value] of Object.entries(input.overrideConfig ?? {})) {
    nextConfig = Object.freeze({ ...nextConfig, [key]: value });
  }

  return nextConfig;
}

function replaceNodeById(input: {
  readonly node: StudioAssetCompositionNode;
  readonly nodeId: string;
  readonly replacement: StudioAssetCompositionNode;
}): StudioAssetCompositionNode {
  if (input.node.nodeId === input.nodeId) {
    return input.replacement;
  }

  return Object.freeze({
    ...input.node,
    slots: input.node.slots
      ? Object.freeze(input.node.slots.map((placement) => Object.freeze({
        placementId: placement.placementId,
        children: Object.freeze(placement.children.map((child) => replaceNodeById({
          node: child,
          nodeId: input.nodeId,
          replacement: input.replacement,
        }))),
      })))
      : undefined,
    regions: input.node.regions
      ? Object.freeze(input.node.regions.map((placement) => Object.freeze({
        placementId: placement.placementId,
        children: Object.freeze(placement.children.map((child) => replaceNodeById({
          node: child,
          nodeId: input.nodeId,
          replacement: input.replacement,
        }))),
      })))
      : undefined,
  });
}

function createReplacedNode(input: {
  readonly node: StudioAssetCompositionNode;
  readonly registry: StudioAssetRegistry;
  readonly replacementAssetId: string;
  readonly config?: Readonly<Record<string, unknown>>;
}): StudioAssetCompositionNode | undefined {
  const replacementRegistration = input.registry.getById(input.replacementAssetId);
  if (!replacementRegistration) {
    return undefined;
  }

  return Object.freeze({
    ...input.node,
    assetId: replacementRegistration.id,
    assetVersion: replacementRegistration.contractVersion,
    config: mergeReplacementConfig({
      registry: input.registry,
      currentNode: input.node,
      targetAssetId: replacementRegistration.id,
      overrideConfig: input.config,
    }),
  });
}

function listBlockingIssues(issues: ReadonlyArray<StudioAssetCompositionValidationIssue>): ReadonlyArray<StudioAssetCompositionValidationIssue> {
  return Object.freeze(issues.filter((issue) => issue.code !== "slot-required" && issue.code !== "region-required"));
}

function evaluateReplacementCompatibility(input: {
  readonly registry: StudioAssetRegistry;
  readonly root: StudioAssetCompositionNode;
  readonly nodeId: string;
  readonly replacementAssetId: string;
}): { readonly compatible: boolean; readonly reason?: string } {
  const replaced = replaceStudioAssetInCompositionTree({
    registry: input.registry,
    request: {
      root: input.root,
      nodeId: input.nodeId,
      replacementAssetId: input.replacementAssetId,
    },
  });
  if (replaced.ok) {
    return Object.freeze({ compatible: true });
  }
  return Object.freeze({
    compatible: false,
    reason: replaced.issues?.[0]?.message ?? replaced.message,
  });
}

export function listCompatibleStudioAssetReplacements(input: {
  readonly registry: StudioAssetRegistry;
  readonly root: StudioAssetCompositionNode;
  readonly nodeId: string;
}): ReadonlyArray<StudioAssetReplacementCandidate> {
  const located = findNodeAndParent({
    root: input.root,
    nodeId: input.nodeId,
  });
  if (!located) {
    return Object.freeze([]);
  }

  return Object.freeze(input.registry.list().map((registration) => {
    const compatibility = evaluateReplacementCompatibility({
      registry: input.registry,
      root: input.root,
      nodeId: located.node.nodeId,
      replacementAssetId: registration.id,
    });
    return Object.freeze({
      assetId: registration.id,
      title: registration.metadata.title,
      description: registration.metadata.summary,
      compatible: compatibility.compatible,
      reason: compatibility.reason,
    });
  }));
}

export function replaceStudioAssetInCompositionTree(input: {
  readonly registry: StudioAssetRegistry;
  readonly request: {
    readonly root: StudioAssetCompositionNode;
    readonly nodeId: string;
    readonly replacementAssetId: string;
    readonly config?: Readonly<Record<string, unknown>>;
  };
}): StudioAssetReplacementResult {
  const located = findNodeAndParent({
    root: input.request.root,
    nodeId: input.request.nodeId,
  });
  if (!located) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetReplacementFailureKinds.unknownNode,
      message: `Asset node '${input.request.nodeId}' was not found.`,
    });
  }

  const replacementRegistration = input.registry.getById(input.request.replacementAssetId);
  if (!replacementRegistration) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetReplacementFailureKinds.unknownAsset,
      message: `Replacement asset '${input.request.replacementAssetId}' is not registered.`,
    });
  }

  const replacedNode = createReplacedNode({
    node: located.node,
    registry: input.registry,
    replacementAssetId: replacementRegistration.id,
    config: input.request.config,
  });
  if (!replacedNode) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetReplacementFailureKinds.unknownAsset,
      message: `Replacement asset '${input.request.replacementAssetId}' is not registered.`,
    });
  }

  const nextRoot = replaceNodeById({
    node: input.request.root,
    nodeId: input.request.nodeId,
    replacement: replacedNode,
  });

  const validation = input.registry.validateCompositionTree(nextRoot);
  const blockingIssues = listBlockingIssues(validation.issues);
  if (!validation.valid && blockingIssues.length > 0) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetReplacementFailureKinds.invalidByValidation,
      message: "Replacement violates composition validation rules.",
      issues: blockingIssues,
    });
  }

  return Object.freeze({
    ok: true,
    root: nextRoot,
    replacedNode,
  });
}
