import {
  StudioUiAssetKinds,
  type ComposedStudioAssetContract,
  type StudioAssetContract,
  type SystemPageAssetContract,
} from "./StudioAssetContracts";
import {
  StudioAssetCompositionValidationIssueCodes,
  type StudioAssetCompositionNode,
  type StudioAssetCompositionPlacementNode,
  type StudioAssetCompositionValidationIssue,
} from "./StudioAssetComposition";
import type { StudioAssetRegistration, StudioAssetRegistry } from "./StudioAssetRegistry";

export const StudioAssetInsertionFailureKinds = Object.freeze({
  unknownAsset: "unknown-asset",
  unknownParent: "unknown-parent",
  invalidContainer: "invalid-container",
  invalidPlacement: "invalid-placement",
  invalidByValidation: "invalid-by-validation",
});

export type StudioAssetInsertionFailureKind =
  typeof StudioAssetInsertionFailureKinds[keyof typeof StudioAssetInsertionFailureKinds];

export type StudioAssetInsertionPlacementKind = "slot" | "region";

export interface StudioAssetInsertionTarget {
  readonly parentNodeId: string;
  readonly placementKind: StudioAssetInsertionPlacementKind;
  readonly placementId: string;
  readonly index?: number;
}

export interface StudioAssetInsertionRequest {
  readonly root: StudioAssetCompositionNode;
  readonly assetId: string;
  readonly target: StudioAssetInsertionTarget;
  readonly nodeId?: string;
  readonly config?: Readonly<Record<string, unknown>>;
}

export interface StudioAssetInstantiation {
  readonly node: StudioAssetCompositionNode;
  readonly registration: StudioAssetRegistration;
}

export type StudioAssetInsertionResult =
  | {
    readonly ok: true;
    readonly root: StudioAssetCompositionNode;
    readonly insertedNode: StudioAssetCompositionNode;
    readonly registration: StudioAssetRegistration;
  }
  | {
    readonly ok: false;
    readonly kind: StudioAssetInsertionFailureKind;
    readonly message: string;
    readonly issues?: ReadonlyArray<StudioAssetCompositionValidationIssue>;
  };

function createNodeId(assetId: string): string {
  const suffix = assetId.split(":").at(-1) ?? "asset";
  return `node-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
}

function instantiateNode(input: {
  readonly registry: StudioAssetRegistry;
  readonly assetId: string;
  readonly nodeId?: string;
  readonly config?: Readonly<Record<string, unknown>>;
}): StudioAssetInstantiation | undefined {
  const registration = input.registry.getById(input.assetId);
  if (!registration) {
    return undefined;
  }

  return Object.freeze({
    registration,
    node: Object.freeze({
      nodeId: input.nodeId?.trim() || createNodeId(registration.id),
      assetId: registration.id,
      assetVersion: registration.contractVersion,
      config: input.config ? Object.freeze({ ...input.config }) : undefined,
    }),
  });
}

function clonePlacementWithInsertion(input: {
  readonly placement: StudioAssetCompositionPlacementNode;
  readonly node: StudioAssetCompositionNode;
  readonly index?: number;
}): StudioAssetCompositionPlacementNode {
  const children = [...input.placement.children];
  const at = input.index === undefined
    ? children.length
    : Math.max(0, Math.min(input.index, children.length));
  children.splice(at, 0, input.node);
  return Object.freeze({
    placementId: input.placement.placementId,
    children: Object.freeze(children),
  });
}

function ensurePlacementExists(
  placements: ReadonlyArray<StudioAssetCompositionPlacementNode> | undefined,
  placementId: string,
): StudioAssetCompositionPlacementNode {
  return placements?.find((entry) => entry.placementId === placementId)
    ?? Object.freeze({ placementId, children: Object.freeze([]) });
}

function findByNodeId(node: StudioAssetCompositionNode, nodeId: string): StudioAssetCompositionNode | undefined {
  if (node.nodeId === nodeId) {
    return node;
  }

  const children = [
    ...(node.slots ?? []).flatMap((placement) => placement.children),
    ...(node.regions ?? []).flatMap((placement) => placement.children),
  ];

  for (const child of children) {
    const resolved = findByNodeId(child, nodeId);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function placementAllowed(contract: StudioAssetContract<unknown>, target: StudioAssetInsertionTarget): boolean {
  if (target.placementKind === "slot") {
    if (contract.kind !== StudioUiAssetKinds.composed) {
      return false;
    }
    return contract.childSlots.some((slot) => slot.slotId === target.placementId);
  }

  if (contract.kind !== StudioUiAssetKinds.systemPage) {
    return false;
  }
  return contract.pageStructure.regions.some((region) => region.regionId === target.placementId);
}

function insertUnderNode(input: {
  readonly node: StudioAssetCompositionNode;
  readonly request: StudioAssetInsertionRequest;
  readonly insertedNode: StudioAssetCompositionNode;
}): StudioAssetCompositionNode {
  if (input.node.nodeId !== input.request.target.parentNodeId) {
    const rewrittenSlots = input.node.slots?.map((placement) => Object.freeze({
      placementId: placement.placementId,
      children: Object.freeze(placement.children.map((child) =>
        insertUnderNode({ node: child, request: input.request, insertedNode: input.insertedNode }))),
    }));
    const rewrittenRegions = input.node.regions?.map((placement) => Object.freeze({
      placementId: placement.placementId,
      children: Object.freeze(placement.children.map((child) =>
        insertUnderNode({ node: child, request: input.request, insertedNode: input.insertedNode }))),
    }));

    return Object.freeze({
      ...input.node,
      slots: rewrittenSlots ? Object.freeze(rewrittenSlots) : undefined,
      regions: rewrittenRegions ? Object.freeze(rewrittenRegions) : undefined,
    });
  }

  if (input.request.target.placementKind === "slot") {
    const placement = ensurePlacementExists(input.node.slots, input.request.target.placementId);
    const nextSlots = [
      ...(input.node.slots ?? []).filter((entry) => entry.placementId !== input.request.target.placementId),
      clonePlacementWithInsertion({ placement, node: input.insertedNode, index: input.request.target.index }),
    ].sort((left, right) => left.placementId.localeCompare(right.placementId));
    return Object.freeze({ ...input.node, slots: Object.freeze(nextSlots) });
  }

  const placement = ensurePlacementExists(input.node.regions, input.request.target.placementId);
  const nextRegions = [
    ...(input.node.regions ?? []).filter((entry) => entry.placementId !== input.request.target.placementId),
    clonePlacementWithInsertion({ placement, node: input.insertedNode, index: input.request.target.index }),
  ].sort((left, right) => left.placementId.localeCompare(right.placementId));
  return Object.freeze({ ...input.node, regions: Object.freeze(nextRegions) });
}

function listInsertionBlockingIssues(
  issues: ReadonlyArray<StudioAssetCompositionValidationIssue>,
): ReadonlyArray<StudioAssetCompositionValidationIssue> {
  return Object.freeze(issues.filter((issue) => issue.code !== StudioAssetCompositionValidationIssueCodes.slotRequired
    && issue.code !== StudioAssetCompositionValidationIssueCodes.regionRequired));
}

export function insertStudioAssetIntoCompositionTree(input: {
  readonly registry: StudioAssetRegistry;
  readonly request: StudioAssetInsertionRequest;
}): StudioAssetInsertionResult {
  const instantiated = instantiateNode({
    registry: input.registry,
    assetId: input.request.assetId,
    nodeId: input.request.nodeId,
    config: input.request.config,
  });

  if (!instantiated) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetInsertionFailureKinds.unknownAsset,
      message: `Asset '${input.request.assetId}' is not registered.`,
    });
  }

  const parentNode = findByNodeId(input.request.root, input.request.target.parentNodeId);
  if (!parentNode) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetInsertionFailureKinds.unknownParent,
      message: `Parent node '${input.request.target.parentNodeId}' was not found.`,
    });
  }

  const parentRegistration = input.registry.getById(parentNode.assetId);
  if (!parentRegistration) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetInsertionFailureKinds.invalidContainer,
      message: `Parent asset '${parentNode.assetId}' is not registered.`,
    });
  }

  if (!placementAllowed(parentRegistration.contract, input.request.target)) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetInsertionFailureKinds.invalidPlacement,
      message: `Placement '${input.request.target.placementId}' is not valid for parent '${parentNode.assetId}'.`,
    });
  }

  const nextRoot = insertUnderNode({
    node: input.request.root,
    request: input.request,
    insertedNode: instantiated.node,
  });

  const validation = input.registry.validateCompositionTree(nextRoot);
  const blockingIssues = listInsertionBlockingIssues(validation.issues);
  if (!validation.valid && blockingIssues.length > 0) {
    return Object.freeze({
      ok: false,
      kind: StudioAssetInsertionFailureKinds.invalidByValidation,
      message: "Asset insertion violated composition validation rules.",
      issues: blockingIssues,
    });
  }

  return Object.freeze({
    ok: true,
    root: nextRoot,
    insertedNode: instantiated.node,
    registration: instantiated.registration,
  });
}

function firstComposedSlot(contract: ComposedStudioAssetContract<unknown>): string | undefined {
  return contract.childSlots[0]?.slotId;
}

function firstSystemRegion(contract: SystemPageAssetContract<unknown>): string | undefined {
  return contract.pageStructure.defaultRegionId ?? contract.pageStructure.regions[0]?.regionId;
}

export function resolveDefaultInsertionTarget(input: {
  readonly registry: StudioAssetRegistry;
  readonly root: StudioAssetCompositionNode;
  readonly parentNodeId: string;
}): StudioAssetInsertionTarget | undefined {
  const parentNode = findByNodeId(input.root, input.parentNodeId);
  if (!parentNode) {
    return undefined;
  }

  const registration = input.registry.getById(parentNode.assetId);
  if (!registration) {
    return undefined;
  }

  if (registration.contract.kind === StudioUiAssetKinds.composed) {
    const placementId = firstComposedSlot(registration.contract);
    return placementId
      ? Object.freeze({ parentNodeId: parentNode.nodeId, placementKind: "slot", placementId })
      : undefined;
  }

  if (registration.contract.kind === StudioUiAssetKinds.systemPage) {
    const placementId = firstSystemRegion(registration.contract);
    return placementId
      ? Object.freeze({ parentNodeId: parentNode.nodeId, placementKind: "region", placementId })
      : undefined;
  }

  return undefined;
}
