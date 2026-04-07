import {
  StudioUiAssetKinds,
  type StudioAssetContract,
  type StudioAssetDefinition,
  type StudioUiAssetKind,
} from "./StudioAssetContracts";
import {
  defaultAtomicStudioUiPrimitiveContracts,
} from "./StudioUiPrimitiveAssetContracts";
import { defaultComposedStudioUiContracts } from "./StudioUiComposedAssetContracts";
import {
  studioSurfaceAssetDefinitions,
} from "./StudioSurfaceAssetDefinitions";
import { imageManipulationEditorPageAssetDefinition } from "./ImageManipulationEditorPageAsset";
import type { StudioEmbeddedEvent } from "./StudioEmbeddedEventContracts";
import {
  deserializeStudioAssetCompositionDocument,
  serializeStudioAssetCompositionDocument,
  validateStudioAssetCompositionTree,
  type StudioAssetCompositionNode,
  type StudioAssetCompositionValidationResult,
} from "./StudioAssetComposition";

export const StudioAssetRegistrationCategories = Object.freeze({
  atomicUi: "atomic-ui",
  composedUi: "composed-ui",
  systemPage: "system-page",
});

export type StudioAssetRegistrationCategory =
  typeof StudioAssetRegistrationCategories[keyof typeof StudioAssetRegistrationCategories];

export interface StudioAssetRegistration {
  readonly id: string;
  readonly kind: StudioUiAssetKind;
  readonly category: StudioAssetRegistrationCategory;
  readonly contractVersion: string;
  readonly contract: StudioAssetContract<unknown>;
  readonly renderer: {
    readonly renderer: "react";
    readonly resolution: "definition-render";
  };
  readonly metadata: {
    readonly id: string;
    readonly assetType: string;
    readonly title: string;
    readonly summary?: string;
    readonly group: string;
    readonly iconToken?: string;
    readonly tags: ReadonlyArray<string>;
    readonly keywords: ReadonlyArray<string>;
    readonly contractCategory: string;
    readonly capabilityFlags: ReadonlyArray<string>;
  };
  readonly hooks: {
    readonly propsSchemaId: string;
    readonly propsSchemaVersion: string;
    readonly persistenceDocumentType: string;
    readonly persistenceSerialization: "json";
  };
  readonly composition?: {
    readonly allowsChildren: boolean;
    readonly allowsNestedStudios?: boolean;
    readonly allowsNestedPages?: boolean;
    readonly allowedChildKinds: ReadonlyArray<StudioUiAssetKind>;
  };
  readonly definition?: StudioAssetDefinition<unknown, StudioEmbeddedEvent>;
}

export const StudioAssetRendererResolutionKinds = Object.freeze({
  resolved: "resolved",
  missing: "missing",
  invalid: "invalid",
});

export type StudioAssetRendererResolutionKind =
  typeof StudioAssetRendererResolutionKinds[keyof typeof StudioAssetRendererResolutionKinds];

export interface StudioAssetRendererResolution {
  readonly kind: StudioAssetRendererResolutionKind;
  readonly assetId: string;
  readonly message?: string;
  readonly registration?: StudioAssetRegistration;
  readonly render?: StudioAssetDefinition<unknown, StudioEmbeddedEvent>["render"];
}

function freezeRegistration(registration: StudioAssetRegistration): StudioAssetRegistration {
  return Object.freeze({
    ...registration,
    metadata: Object.freeze({
      ...registration.metadata,
      tags: Object.freeze([...registration.metadata.tags]),
      keywords: Object.freeze([...registration.metadata.keywords]),
      capabilityFlags: Object.freeze([...registration.metadata.capabilityFlags]),
    }),
    hooks: Object.freeze({ ...registration.hooks }),
    composition: registration.composition
      ? Object.freeze({
        ...registration.composition,
        allowedChildKinds: Object.freeze([...registration.composition.allowedChildKinds]),
      })
      : undefined,
  });
}

function assertContractRegistrationConsistency(contract: StudioAssetContract<unknown>, registrationId: string): void {
  if (contract.kind === StudioUiAssetKinds.atomic) {
    if (contract.constraints.allowsChildren) {
      throw new Error(`Studio asset '${registrationId}' atomic contracts cannot allow children.`);
    }
    return;
  }

  if (contract.kind === StudioUiAssetKinds.composed) {
    if (contract.childSlots.length === 0) {
      throw new Error(`Studio asset '${registrationId}' composed contracts require at least one child slot.`);
    }

    const seen = new Set<string>();
    for (const slot of contract.childSlots) {
      const slotId = slot.slotId.trim();
      if (!slotId) {
        throw new Error(`Studio asset '${registrationId}' has a composed slot with an empty slotId.`);
      }
      if (seen.has(slotId)) {
        throw new Error(`Studio asset '${registrationId}' defines duplicate slot '${slotId}'.`);
      }
      seen.add(slotId);
      if (slot.allowedChildKinds.length === 0) {
        throw new Error(`Studio asset '${registrationId}' slot '${slotId}' must allow at least one child kind.`);
      }
    }
    return;
  }

  if (contract.pageStructure.regions.length === 0) {
    throw new Error(`Studio asset '${registrationId}' system-page contracts require at least one region.`);
  }
  const seen = new Set<string>();
  for (const region of contract.pageStructure.regions) {
    const regionId = region.regionId.trim();
    if (!regionId) {
      throw new Error(`Studio asset '${registrationId}' has a system-page region with an empty regionId.`);
    }
    if (seen.has(regionId)) {
      throw new Error(`Studio asset '${registrationId}' defines duplicate region '${regionId}'.`);
    }
    seen.add(regionId);
    if (region.allowedChildKinds.length === 0) {
      throw new Error(`Studio asset '${registrationId}' region '${regionId}' must allow at least one child kind.`);
    }
  }
}

function normalizeRegistration(registration: StudioAssetRegistration): StudioAssetRegistration {
  const id = registration.id.trim();
  if (!id) {
    throw new Error("Studio asset registration id is required.");
  }
  const contractVersion = registration.contractVersion.trim();
  if (!contractVersion) {
    throw new Error(`Studio asset registration '${id}' contractVersion is required.`);
  }

  const title = registration.metadata.title.trim();
  if (!title) {
    throw new Error(`Studio asset registration '${id}' title is required.`);
  }

  const assetType = registration.metadata.assetType.trim();
  if (!assetType) {
    throw new Error(`Studio asset registration '${id}' assetType is required.`);
  }

  const group = registration.metadata.group.trim();
  if (!group) {
    throw new Error(`Studio asset registration '${id}' metadata group is required.`);
  }

  const contractCategory = registration.metadata.contractCategory.trim();
  if (!contractCategory) {
    throw new Error(`Studio asset registration '${id}' metadata contract category is required.`);
  }

  assertContractRegistrationConsistency(registration.contract, id);

  return freezeRegistration({
    ...registration,
    id,
    contractVersion,
    metadata: {
      ...registration.metadata,
      id,
      assetType,
      title,
      summary: registration.metadata.summary?.trim() || undefined,
      group,
      iconToken: registration.metadata.iconToken?.trim() || undefined,
      contractCategory,
    },
  });
}

function categoryFromKind(kind: StudioUiAssetKind): StudioAssetRegistrationCategory {
  if (kind === StudioUiAssetKinds.atomic) {
    return StudioAssetRegistrationCategories.atomicUi;
  }
  if (kind === StudioUiAssetKinds.composed) {
    return StudioAssetRegistrationCategories.composedUi;
  }
  return StudioAssetRegistrationCategories.systemPage;
}

function registrationFromContract(contract: StudioAssetContract<unknown>): StudioAssetRegistration {
  const metadataTags = contract.metadata?.tags ?? [];
  const metadataKeywords = contract.metadata?.keywords ?? [];
  const capabilityFlags = contract.metadata?.capabilityFlags ?? [];
  const composition = contract.kind === StudioUiAssetKinds.atomic
    ? {
      allowsChildren: false,
      allowedChildKinds: Object.freeze([]),
    }
    : contract.kind === StudioUiAssetKinds.composed
      ? {
        allowsChildren: true,
        allowsNestedStudios: contract.compositionRules.allowsNestedStudios,
        allowedChildKinds: contract.compositionRules.allowedChildKinds,
      }
      : {
        allowsChildren: true,
        allowsNestedPages: contract.compositionRules.allowsNestedPages,
        allowedChildKinds: contract.compositionRules.allowedChildKinds,
      };

  return normalizeRegistration({
    id: contract.identity.studioId,
    kind: contract.kind,
    category: categoryFromKind(contract.kind),
    contractVersion: contract.contractVersion,
    contract,
    renderer: {
      renderer: contract.rendering.renderer,
      resolution: contract.rendering.resolution,
    },
    metadata: {
      id: contract.identity.studioId,
      assetType: contract.identity.studioType,
      title: contract.identity.title,
      summary: contract.identity.summary,
      group: contract.metadata?.group ?? categoryFromKind(contract.kind),
      iconToken: contract.metadata?.iconToken,
      tags: metadataTags,
      keywords: metadataKeywords,
      contractCategory: contract.metadata?.contractCategory ?? `${contract.kind}/${categoryFromKind(contract.kind)}`,
      capabilityFlags,
    },
    hooks: {
      propsSchemaId: contract.propsSchema.schemaId,
      propsSchemaVersion: contract.propsSchema.schemaVersion,
      persistenceDocumentType: contract.persistence.documentType,
      persistenceSerialization: contract.persistence.serialization,
    },
    composition,
  });
}

function registrationFromDefinition(definition: StudioAssetDefinition<unknown, StudioEmbeddedEvent>): StudioAssetRegistration {
  return normalizeRegistration({
    ...registrationFromContract(definition.contract),
    definition,
  });
}

export class StudioAssetRegistry {
  private readonly byId = new Map<string, StudioAssetRegistration>();

  public register(registration: StudioAssetRegistration): void {
    const normalized = normalizeRegistration(registration);
    if (this.byId.has(normalized.id)) {
      throw new Error(`Studio asset '${normalized.id}' is already registered.`);
    }
    this.byId.set(normalized.id, normalized);
  }

  public registerMany(registrations: ReadonlyArray<StudioAssetRegistration>): void {
    for (const registration of registrations) {
      this.register(registration);
    }
  }

  public getById(id: string): StudioAssetRegistration | undefined {
    return this.byId.get(id.trim());
  }

  public list(): ReadonlyArray<StudioAssetRegistration> {
    return Object.freeze([...this.byId.values()].sort((left, right) => left.id.localeCompare(right.id)));
  }

  public listByKind(kind: StudioUiAssetKind): ReadonlyArray<StudioAssetRegistration> {
    return Object.freeze(this.list().filter((entry) => entry.kind === kind));
  }

  public listByCategory(category: StudioAssetRegistrationCategory): ReadonlyArray<StudioAssetRegistration> {
    return Object.freeze(this.list().filter((entry) => entry.category === category));
  }

  public resolveDefinitionById(id: string): StudioAssetDefinition<unknown, StudioEmbeddedEvent> | undefined {
    return this.getById(id)?.definition;
  }

  public resolveRendererById(id: string): StudioAssetRendererResolution {
    const normalizedId = id.trim();
    const registration = this.getById(normalizedId);
    if (!registration) {
      return Object.freeze({
        kind: StudioAssetRendererResolutionKinds.missing,
        assetId: normalizedId,
        message: `Studio asset '${normalizedId}' is not registered.`,
      });
    }

    const definition = registration.definition;
    if (!definition) {
      return Object.freeze({
        kind: StudioAssetRendererResolutionKinds.missing,
        assetId: normalizedId,
        registration,
        message: `Studio asset '${normalizedId}' does not expose a runtime renderer definition.`,
      });
    }

    if (definition.contract.rendering.renderer !== registration.renderer.renderer
      || definition.contract.rendering.resolution !== registration.renderer.resolution) {
      return Object.freeze({
        kind: StudioAssetRendererResolutionKinds.invalid,
        assetId: normalizedId,
        registration,
        message: `Studio asset '${normalizedId}' renderer registration does not match its contract definition.`,
      });
    }

    return Object.freeze({
      kind: StudioAssetRendererResolutionKinds.resolved,
      assetId: normalizedId,
      registration,
      render: definition.render,
    });
  }

  public resolveRenderersByKind(kind: StudioUiAssetKind): ReadonlyArray<StudioAssetRendererResolution> {
    return Object.freeze(this.listByKind(kind).map((entry) => this.resolveRendererById(entry.id)));
  }

  public resolveRenderersByCategory(category: StudioAssetRegistrationCategory): ReadonlyArray<StudioAssetRendererResolution> {
    return Object.freeze(this.listByCategory(category).map((entry) => this.resolveRendererById(entry.id)));
  }

  public validateCompositionTree(root: StudioAssetCompositionNode): StudioAssetCompositionValidationResult {
    return validateStudioAssetCompositionTree({ root, registry: this });
  }

  public serializeCompositionTree(root: StudioAssetCompositionNode): string {
    return serializeStudioAssetCompositionDocument({
      root,
      registry: this,
    });
  }

  public deserializeCompositionTree(input: { readonly serialized: string; readonly validate?: boolean }): {
    readonly root: StudioAssetCompositionNode;
    readonly validation: StudioAssetCompositionValidationResult;
  } {
    return deserializeStudioAssetCompositionDocument({
      serialized: input.serialized,
      validate: input.validate,
      registry: this,
    });
  }
}

export function createDefaultStudioAssetRegistry(): StudioAssetRegistry {
  const registry = new StudioAssetRegistry();
  registry.registerMany(defaultAtomicStudioUiPrimitiveContracts.map((contract) => registrationFromContract(contract)));
  registry.registerMany(defaultComposedStudioUiContracts.map((contract) => registrationFromContract(contract)));
  registry.registerMany(
    studioSurfaceAssetDefinitions
      .map((definition) => definition as StudioAssetDefinition<unknown, StudioEmbeddedEvent>)
      .map((definition) => registrationFromDefinition(definition)),
  );
  registry.registerMany(
    [imageManipulationEditorPageAssetDefinition]
      .map((definition) => definition as StudioAssetDefinition<unknown, StudioEmbeddedEvent>)
      .map((definition) => registrationFromDefinition(definition)),
  );
  return registry;
}
