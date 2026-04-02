import type { StudioAssetCompositionNode } from "./StudioAssetComposition";

export interface StudioAssetSelectionState {
  readonly selectedNodeId?: string;
}

export interface StudioAssetSelectionBinding {
  readonly selectedNodeId?: string;
  readonly selectedNode?: StudioAssetCompositionNode;
}

function findNodeById(node: StudioAssetCompositionNode, nodeId: string): StudioAssetCompositionNode | undefined {
  if (node.nodeId === nodeId) {
    return node;
  }

  const children = [
    ...(node.slots ?? []).flatMap((placement) => placement.children),
    ...(node.regions ?? []).flatMap((placement) => placement.children),
  ];

  for (const child of children) {
    const resolved = findNodeById(child, nodeId);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function updateNodeConfigById(input: {
  readonly node: StudioAssetCompositionNode;
  readonly nodeId: string;
  readonly config: Readonly<Record<string, unknown>>;
}): StudioAssetCompositionNode {
  if (input.node.nodeId === input.nodeId) {
    return Object.freeze({
      ...input.node,
      config: Object.freeze({ ...input.config }),
    });
  }

  const nextSlots = input.node.slots?.map((placement) => Object.freeze({
    placementId: placement.placementId,
    children: Object.freeze(placement.children.map((child) => updateNodeConfigById({
      node: child,
      nodeId: input.nodeId,
      config: input.config,
    }))),
  }));
  const nextRegions = input.node.regions?.map((placement) => Object.freeze({
    placementId: placement.placementId,
    children: Object.freeze(placement.children.map((child) => updateNodeConfigById({
      node: child,
      nodeId: input.nodeId,
      config: input.config,
    }))),
  }));

  return Object.freeze({
    ...input.node,
    slots: nextSlots ? Object.freeze(nextSlots) : undefined,
    regions: nextRegions ? Object.freeze(nextRegions) : undefined,
  });
}

export function bindStudioAssetSelection(input: {
  readonly root?: StudioAssetCompositionNode;
  readonly selection?: StudioAssetSelectionState;
}): StudioAssetSelectionBinding {
  const selectedNodeId = input.selection?.selectedNodeId?.trim();
  if (!input.root || !selectedNodeId) {
    return Object.freeze({ selectedNodeId: undefined, selectedNode: undefined });
  }

  const selectedNode = findNodeById(input.root, selectedNodeId);
  return Object.freeze({
    selectedNodeId,
    selectedNode,
  });
}

export function applyConfigToSelectedStudioAsset(input: {
  readonly root: StudioAssetCompositionNode;
  readonly selection: StudioAssetSelectionState;
  readonly config: Readonly<Record<string, unknown>>;
}): StudioAssetCompositionNode {
  const selectedNodeId = input.selection.selectedNodeId?.trim();
  if (!selectedNodeId) {
    return input.root;
  }
  return updateNodeConfigById({
    node: input.root,
    nodeId: selectedNodeId,
    config: input.config,
  });
}
