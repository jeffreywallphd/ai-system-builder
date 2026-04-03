import type { StudioAssetCompositionNode } from "./StudioAssetComposition";

export interface StudioAssetSelectionState {
  readonly selectedNodeId?: string;
  readonly focusedPathNodeIds?: ReadonlyArray<string>;
}

export interface StudioAssetSelectionPathEntry {
  readonly nodeId: string;
  readonly assetId: string;
}

export interface StudioAssetSelectionBinding {
  readonly selectedNodeId?: string;
  readonly selectedNode?: StudioAssetCompositionNode;
  readonly focusedNodeId?: string;
  readonly focusedNode?: StudioAssetCompositionNode;
  readonly path: ReadonlyArray<StudioAssetSelectionPathEntry>;
  readonly stale: boolean;
}

function collectChildren(node: StudioAssetCompositionNode): ReadonlyArray<StudioAssetCompositionNode> {
  return Object.freeze([
    ...(node.slots ?? []).flatMap((placement) => placement.children),
    ...(node.regions ?? []).flatMap((placement) => placement.children),
  ]);
}

function findNodeById(node: StudioAssetCompositionNode, nodeId: string): StudioAssetCompositionNode | undefined {
  if (node.nodeId === nodeId) {
    return node;
  }

  for (const child of collectChildren(node)) {
    const resolved = findNodeById(child, nodeId);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function findPathByNodeId(
  node: StudioAssetCompositionNode,
  nodeId: string,
  path: ReadonlyArray<StudioAssetCompositionNode> = Object.freeze([]),
): ReadonlyArray<StudioAssetCompositionNode> | undefined {
  const nextPath = Object.freeze([...path, node]);
  if (node.nodeId === nodeId) {
    return nextPath;
  }

  for (const child of collectChildren(node)) {
    const resolved = findPathByNodeId(child, nodeId, nextPath);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function normalizeSelectionPath(path: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  if (!path || path.length === 0) {
    return Object.freeze([]);
  }
  const seen = new Set<string>();
  return Object.freeze(path
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    }));
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
    return Object.freeze({
      selectedNodeId: undefined,
      selectedNode: undefined,
      focusedNodeId: undefined,
      focusedNode: undefined,
      path: Object.freeze([]),
      stale: false,
    });
  }

  const selectedPath = findPathByNodeId(input.root, selectedNodeId);
  if (!selectedPath) {
    return Object.freeze({
      selectedNodeId,
      selectedNode: undefined,
      focusedNodeId: undefined,
      focusedNode: undefined,
      path: Object.freeze([]),
      stale: true,
    });
  }

  const path = Object.freeze(selectedPath.map((node) => Object.freeze({
    nodeId: node.nodeId,
    assetId: node.assetId,
  })));

  const focusedPath = normalizeSelectionPath(input.selection?.focusedPathNodeIds);
  const focusedNodeId = [...focusedPath].reverse().find((entry) => selectedPath.some((node) => node.nodeId === entry));
  const focusedNode = focusedNodeId
    ? findNodeById(input.root, focusedNodeId)
    : selectedPath[selectedPath.length - 1];

  return Object.freeze({
    selectedNodeId,
    selectedNode: selectedPath[selectedPath.length - 1],
    focusedNodeId: focusedNode?.nodeId,
    focusedNode,
    path,
    stale: false,
  });
}

export function createStudioAssetSelectionState(input: {
  readonly root?: StudioAssetCompositionNode;
  readonly nodeId?: string;
}): StudioAssetSelectionState {
  const nodeId = input.nodeId?.trim();
  if (!input.root || !nodeId) {
    return Object.freeze({ selectedNodeId: undefined, focusedPathNodeIds: Object.freeze([]) });
  }

  const path = findPathByNodeId(input.root, nodeId);
  if (!path) {
    return Object.freeze({ selectedNodeId: undefined, focusedPathNodeIds: Object.freeze([]) });
  }

  return Object.freeze({
    selectedNodeId: nodeId,
    focusedPathNodeIds: Object.freeze(path.map((node) => node.nodeId)),
  });
}

export function navigateStudioAssetSelectionToPathNode(input: {
  readonly root?: StudioAssetCompositionNode;
  readonly selection?: StudioAssetSelectionState;
  readonly nodeId: string;
}): StudioAssetSelectionState {
  const bound = bindStudioAssetSelection({ root: input.root, selection: input.selection });
  if (!bound.selectedNode || !input.root) {
    return Object.freeze({ selectedNodeId: undefined, focusedPathNodeIds: Object.freeze([]) });
  }

  const targetNodeId = input.nodeId.trim();
  if (!targetNodeId) {
    return Object.freeze({
      selectedNodeId: bound.selectedNode.nodeId,
      focusedPathNodeIds: Object.freeze(bound.path.map((entry) => entry.nodeId)),
    });
  }

  const targetIndex = bound.path.findIndex((entry) => entry.nodeId === targetNodeId);
  const nextPath = targetIndex >= 0
    ? bound.path.slice(0, targetIndex + 1)
    : bound.path;

  return Object.freeze({
    selectedNodeId: bound.selectedNode.nodeId,
    focusedPathNodeIds: Object.freeze(nextPath.map((entry) => entry.nodeId)),
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
