import type {
  AtomicStudioAssetContract,
  ComposedStudioAssetContract,
  ComposedStudioAssetSlotContract,
  StudioAssetContract,
  SystemPageAssetContract,
  SystemPageRegionDescriptor,
} from "./StudioAssetContracts";
import type { StudioAssetRegistration, StudioAssetRegistrationCategory, StudioAssetRegistry } from "./StudioAssetRegistry";

const StudioAssetCompositionSchemaVersion = "1.0.0";

export const StudioAssetCompositionValidationIssueCodes = Object.freeze({
  unknownAsset: "unknown-asset",
  unsupportedContainer: "unsupported-container",
  slotNotSupported: "slot-not-supported",
  slotRequired: "slot-required",
  regionRequired: "region-required",
  childKindNotAllowed: "child-kind-not-allowed",
  childTypeNotAllowed: "child-type-not-allowed",
  childCategoryNotAllowed: "child-category-not-allowed",
  slotCardinalityExceeded: "slot-cardinality-exceeded",
  regionCardinalityExceeded: "region-cardinality-exceeded",
  atomicCannotContainChildren: "atomic-cannot-contain-children",
  invalidNesting: "invalid-nesting",
});

export type StudioAssetCompositionValidationIssueCode =
  typeof StudioAssetCompositionValidationIssueCodes[keyof typeof StudioAssetCompositionValidationIssueCodes];

export interface StudioAssetCompositionMetadataReference {
  readonly draftId?: string;
  readonly panelId?: string;
  readonly regionId?: string;
  readonly experienceAssetIds?: ReadonlyArray<string>;
}

export interface StudioAssetCompositionPlacementNode {
  readonly placementId: string;
  readonly children: ReadonlyArray<StudioAssetCompositionNode>;
}

export interface StudioAssetCompositionNode {
  readonly nodeId: string;
  readonly assetId: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly metadataReferences?: StudioAssetCompositionMetadataReference;
  readonly slots?: ReadonlyArray<StudioAssetCompositionPlacementNode>;
  readonly regions?: ReadonlyArray<StudioAssetCompositionPlacementNode>;
}

export interface StudioAssetCompositionValidationIssue {
  readonly code: StudioAssetCompositionValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface StudioAssetCompositionValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<StudioAssetCompositionValidationIssue>;
}

interface AllowedChildConstraints {
  readonly allowedKinds: ReadonlyArray<string>;
  readonly allowedAssetTypes?: ReadonlyArray<string>;
  readonly allowedRegistrationCategories?: ReadonlyArray<StudioAssetRegistrationCategory>;
  readonly required?: boolean;
  readonly allowsMultiple?: boolean;
}

interface StudioAssetCompositionSerializedDocument {
  readonly schemaVersion: typeof StudioAssetCompositionSchemaVersion;
  readonly root: StudioAssetCompositionNode;
}

function normalizeString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function asOptionalRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

function normalizePlacements(
  value: unknown,
  label: "slot" | "region",
): ReadonlyArray<StudioAssetCompositionPlacementNode> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze(value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Composition ${label} placement at index ${index} must be an object.`);
    }
    const placement = entry as Record<string, unknown>;
    const placementId = normalizeString(placement.placementId, `Composition ${label} placement id`);
    if (!Array.isArray(placement.children)) {
      throw new Error(`Composition ${label} '${placementId}' children must be an array.`);
    }
    return Object.freeze({
      placementId,
      children: Object.freeze(placement.children.map((child, childIndex) =>
        normalizeCompositionNode(child, `${label}:${placementId}.children[${childIndex}]`))),
    });
  }));
}

function normalizeMetadataReferences(value: unknown): StudioAssetCompositionMetadataReference | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const experienceAssetIds = Array.isArray(record.experienceAssetIds)
    ? Object.freeze(record.experienceAssetIds.map((entry) => normalizeString(entry, "Composition metadata experienceAssetId")))
    : undefined;

  return Object.freeze({
    draftId: typeof record.draftId === "string" ? record.draftId.trim() || undefined : undefined,
    panelId: typeof record.panelId === "string" ? record.panelId.trim() || undefined : undefined,
    regionId: typeof record.regionId === "string" ? record.regionId.trim() || undefined : undefined,
    experienceAssetIds,
  });
}

function normalizeCompositionNode(input: unknown, label = "composition node"): StudioAssetCompositionNode {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${label} must be an object.`);
  }
  const record = input as Record<string, unknown>;
  const nodeId = normalizeString(record.nodeId, `${label} nodeId`);
  const assetId = normalizeString(record.assetId, `${label} assetId`);

  return Object.freeze({
    nodeId,
    assetId,
    config: asOptionalRecord(record.config),
    metadataReferences: normalizeMetadataReferences(record.metadataReferences),
    slots: normalizePlacements(record.slots, "slot"),
    regions: normalizePlacements(record.regions, "region"),
  });
}

function collectChildren(node: StudioAssetCompositionNode): ReadonlyArray<StudioAssetCompositionNode> {
  const children: StudioAssetCompositionNode[] = [];
  for (const slot of node.slots ?? []) {
    children.push(...slot.children);
  }
  for (const region of node.regions ?? []) {
    children.push(...region.children);
  }
  return Object.freeze(children);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return current;
    }
    const record = current as Record<string, unknown>;
    return Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((next, key) => {
        next[key] = record[key];
        return next;
      }, {});
  }, 2);
}

function validatePlacementChildren(input: {
  readonly nodePath: string;
  readonly parentRegistration: StudioAssetRegistration;
  readonly placementId: string;
  readonly children: ReadonlyArray<StudioAssetCompositionNode>;
  readonly constraints: AllowedChildConstraints;
  readonly registry: StudioAssetRegistry;
  readonly issues: StudioAssetCompositionValidationIssue[];
}): void {
  const { constraints } = input;
  if (constraints.required && input.children.length === 0) {
    input.issues.push({
      code: input.nodePath.includes(".regions[")
        ? StudioAssetCompositionValidationIssueCodes.regionRequired
        : StudioAssetCompositionValidationIssueCodes.slotRequired,
      path: input.nodePath,
      message: `Placement '${input.placementId}' requires at least one child asset.`,
    });
  }

  if (constraints.allowsMultiple === false && input.children.length > 1) {
    input.issues.push({
      code: input.nodePath.includes(".regions[")
        ? StudioAssetCompositionValidationIssueCodes.regionCardinalityExceeded
        : StudioAssetCompositionValidationIssueCodes.slotCardinalityExceeded,
      path: input.nodePath,
      message: `Placement '${input.placementId}' allows at most one child asset.`,
    });
  }

  for (const [childIndex, child] of input.children.entries()) {
    const childPath = `${input.nodePath}.children[${childIndex}]`;
    const childRegistration = input.registry.getById(child.assetId);
    if (!childRegistration) {
      input.issues.push({
        code: StudioAssetCompositionValidationIssueCodes.unknownAsset,
        path: childPath,
        message: `Child asset '${child.assetId}' is not registered.`,
      });
      continue;
    }

    if (!constraints.allowedKinds.includes(childRegistration.kind)) {
      input.issues.push({
        code: StudioAssetCompositionValidationIssueCodes.childKindNotAllowed,
        path: childPath,
        message: `Child kind '${childRegistration.kind}' is not allowed in placement '${input.placementId}'.`,
      });
    }

    const childType = childRegistration.metadata.assetType;
    if (constraints.allowedAssetTypes && constraints.allowedAssetTypes.length > 0 && !constraints.allowedAssetTypes.includes(childType)) {
      input.issues.push({
        code: StudioAssetCompositionValidationIssueCodes.childTypeNotAllowed,
        path: childPath,
        message: `Child asset type '${childType}' is not allowed in placement '${input.placementId}'.`,
      });
    }

    if (constraints.allowedRegistrationCategories
      && constraints.allowedRegistrationCategories.length > 0
      && !constraints.allowedRegistrationCategories.includes(childRegistration.category)) {
      input.issues.push({
        code: StudioAssetCompositionValidationIssueCodes.childCategoryNotAllowed,
        path: childPath,
        message: `Child registration category '${childRegistration.category}' is not allowed in placement '${input.placementId}'.`,
      });
    }

    if (input.parentRegistration.kind === "composed" && childRegistration.kind === "system-page") {
      input.issues.push({
        code: StudioAssetCompositionValidationIssueCodes.invalidNesting,
        path: childPath,
        message: `Composed asset '${input.parentRegistration.id}' cannot nest system-page child '${childRegistration.id}'.`,
      });
    }
  }
}

function validateAtomicNode(
  contract: AtomicStudioAssetContract<unknown>,
  node: StudioAssetCompositionNode,
  nodePath: string,
  issues: StudioAssetCompositionValidationIssue[],
): void {
  const childCount = collectChildren(node).length;
  if (childCount > 0 || node.slots?.length || node.regions?.length) {
    issues.push({
      code: StudioAssetCompositionValidationIssueCodes.atomicCannotContainChildren,
      path: nodePath,
      message: `Atomic asset '${contract.identity.studioId}' does not allow child assets.`,
    });
  }
}

function validateComposedNode(
  registration: StudioAssetRegistration,
  contract: ComposedStudioAssetContract<unknown>,
  node: StudioAssetCompositionNode,
  nodePath: string,
  registry: StudioAssetRegistry,
  issues: StudioAssetCompositionValidationIssue[],
): void {
  if (node.regions && node.regions.length > 0) {
    issues.push({
      code: StudioAssetCompositionValidationIssueCodes.unsupportedContainer,
      path: `${nodePath}.regions`,
      message: `Composed asset '${registration.id}' must use slots, not regions.`,
    });
  }

  const slotById = new Map<string, ComposedStudioAssetSlotContract>(
    contract.childSlots.map((slot) => [slot.slotId, slot]),
  );

  const providedSlots = node.slots ?? [];
  for (const [index, placement] of providedSlots.entries()) {
    const slotPath = `${nodePath}.slots[${index}]`;
    const slotContract = slotById.get(placement.placementId);
    if (!slotContract) {
      issues.push({
        code: StudioAssetCompositionValidationIssueCodes.slotNotSupported,
        path: slotPath,
        message: `Composed asset '${registration.id}' does not define slot '${placement.placementId}'.`,
      });
      continue;
    }

    validatePlacementChildren({
      nodePath: slotPath,
      parentRegistration: registration,
      placementId: placement.placementId,
      children: placement.children,
      constraints: {
        allowedKinds: slotContract.allowedChildKinds,
        allowedAssetTypes: slotContract.allowedChildAssetTypes,
        allowedRegistrationCategories: slotContract.allowedRegistrationCategories,
        required: slotContract.required,
        allowsMultiple: slotContract.allowsMultiple,
      },
      registry,
      issues,
    });
  }

  for (const slotContract of contract.childSlots) {
    const placement = providedSlots.find((entry) => entry.placementId === slotContract.slotId);
    if (!placement && slotContract.required) {
      issues.push({
        code: StudioAssetCompositionValidationIssueCodes.slotRequired,
        path: `${nodePath}.slots`,
        message: `Required slot '${slotContract.slotId}' is missing for composed asset '${registration.id}'.`,
      });
    }
  }
}

function validateSystemPageNode(
  registration: StudioAssetRegistration,
  contract: SystemPageAssetContract<unknown>,
  node: StudioAssetCompositionNode,
  nodePath: string,
  registry: StudioAssetRegistry,
  issues: StudioAssetCompositionValidationIssue[],
): void {
  if (node.slots && node.slots.length > 0) {
    issues.push({
      code: StudioAssetCompositionValidationIssueCodes.unsupportedContainer,
      path: `${nodePath}.slots`,
      message: `System-page asset '${registration.id}' must use regions, not slots.`,
    });
  }

  const regionById = new Map<string, SystemPageRegionDescriptor>(
    contract.pageStructure.regions.map((region) => [region.regionId, region]),
  );

  const providedRegions = node.regions ?? [];
  for (const [index, placement] of providedRegions.entries()) {
    const regionPath = `${nodePath}.regions[${index}]`;
    const regionContract = regionById.get(placement.placementId);
    if (!regionContract) {
      issues.push({
        code: StudioAssetCompositionValidationIssueCodes.slotNotSupported,
        path: regionPath,
        message: `System-page asset '${registration.id}' does not define region '${placement.placementId}'.`,
      });
      continue;
    }

    validatePlacementChildren({
      nodePath: regionPath,
      parentRegistration: registration,
      placementId: placement.placementId,
      children: placement.children,
      constraints: {
        allowedKinds: regionContract.allowedChildKinds,
        allowedAssetTypes: regionContract.allowedChildAssetTypes,
        allowedRegistrationCategories: regionContract.allowedRegistrationCategories,
        required: regionContract.required,
        allowsMultiple: regionContract.allowsMultiple,
      },
      registry,
      issues,
    });
  }

  for (const regionContract of contract.pageStructure.regions) {
    const placement = providedRegions.find((entry) => entry.placementId === regionContract.regionId);
    if (!placement && regionContract.required) {
      issues.push({
        code: StudioAssetCompositionValidationIssueCodes.regionRequired,
        path: `${nodePath}.regions`,
        message: `Required region '${regionContract.regionId}' is missing for system-page asset '${registration.id}'.`,
      });
    }
  }
}

function validateNodeRecursively(
  node: StudioAssetCompositionNode,
  path: string,
  registry: StudioAssetRegistry,
  issues: StudioAssetCompositionValidationIssue[],
): void {
  const registration = registry.getById(node.assetId);
  if (!registration) {
    issues.push({
      code: StudioAssetCompositionValidationIssueCodes.unknownAsset,
      path,
      message: `Asset '${node.assetId}' is not registered.`,
    });
    return;
  }

  const contract = registration.contract as StudioAssetContract<unknown>;
  if (contract.kind === "atomic") {
    validateAtomicNode(contract, node, path, issues);
  } else if (contract.kind === "composed") {
    validateComposedNode(registration, contract, node, path, registry, issues);
  } else {
    validateSystemPageNode(registration, contract, node, path, registry, issues);
  }

  const childNodes = collectChildren(node);
  for (const [index, child] of childNodes.entries()) {
    validateNodeRecursively(child, `${path}.descendants[${index}]`, registry, issues);
  }
}

export function validateStudioAssetCompositionTree(input: {
  readonly root: StudioAssetCompositionNode;
  readonly registry: StudioAssetRegistry;
}): StudioAssetCompositionValidationResult {
  const root = normalizeCompositionNode(input.root, "composition root");
  const issues: StudioAssetCompositionValidationIssue[] = [];
  validateNodeRecursively(root, "root", input.registry, issues);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze([...issues]),
  });
}

export function serializeStudioAssetCompositionDocument(root: StudioAssetCompositionNode): string {
  const normalizedRoot = normalizeCompositionNode(root, "composition root");
  const document: StudioAssetCompositionSerializedDocument = Object.freeze({
    schemaVersion: StudioAssetCompositionSchemaVersion,
    root: normalizedRoot,
  });
  return stableStringify(document);
}

export function deserializeStudioAssetCompositionDocument(input: {
  readonly serialized: string;
  readonly registry: StudioAssetRegistry;
  readonly validate?: boolean;
}): {
  readonly root: StudioAssetCompositionNode;
  readonly validation: StudioAssetCompositionValidationResult;
} {
  const serialized = normalizeString(input.serialized, "Serialized studio composition document");
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  if (parsed.schemaVersion !== StudioAssetCompositionSchemaVersion) {
    throw new Error(
      `Studio composition schema version '${String(parsed.schemaVersion)}' is not supported. Expected '${StudioAssetCompositionSchemaVersion}'.`,
    );
  }

  const root = normalizeCompositionNode(parsed.root, "composition root");
  const validation = validateStudioAssetCompositionTree({ root, registry: input.registry });
  if ((input.validate ?? true) && !validation.valid) {
    const first = validation.issues[0];
    throw new Error(`Studio composition validation failed at ${first?.path}: ${first?.message}`);
  }

  return Object.freeze({
    root,
    validation,
  });
}
