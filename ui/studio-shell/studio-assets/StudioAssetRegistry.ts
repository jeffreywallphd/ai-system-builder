import {
  StudioUiAssetKinds,
  type StudioAssetContract,
  type StudioAssetDefinition,
  type StudioUiAssetKind,
} from "./StudioAssetContracts";
import {
  defaultAtomicStudioUiPrimitiveContracts,
} from "./StudioUiPrimitiveAssetContracts";
import {
  studioSurfaceAssetDefinitions,
} from "./StudioSurfaceAssetDefinitions";
import type { StudioEmbeddedEvent } from "./StudioEmbeddedEventContracts";

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
  readonly contract: StudioAssetContract<unknown>;
  readonly renderer: {
    readonly renderer: "react";
    readonly resolution: "definition-render";
  };
  readonly metadata: {
    readonly title: string;
    readonly summary?: string;
    readonly tags: ReadonlyArray<string>;
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

function freezeRegistration(registration: StudioAssetRegistration): StudioAssetRegistration {
  return Object.freeze({
    ...registration,
    metadata: Object.freeze({
      ...registration.metadata,
      tags: Object.freeze([...registration.metadata.tags]),
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

function normalizeRegistration(registration: StudioAssetRegistration): StudioAssetRegistration {
  const id = registration.id.trim();
  if (!id) {
    throw new Error("Studio asset registration id is required.");
  }

  const title = registration.metadata.title.trim();
  if (!title) {
    throw new Error(`Studio asset registration '${id}' title is required.`);
  }

  return freezeRegistration({
    ...registration,
    id,
    metadata: {
      ...registration.metadata,
      title,
      summary: registration.metadata.summary?.trim() || undefined,
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
    contract,
    renderer: {
      renderer: contract.rendering.renderer,
      resolution: contract.rendering.resolution,
    },
    metadata: {
      title: contract.identity.title,
      summary: contract.identity.summary,
      tags: metadataTags,
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
}

export function createDefaultStudioAssetRegistry(): StudioAssetRegistry {
  const registry = new StudioAssetRegistry();
  registry.registerMany(defaultAtomicStudioUiPrimitiveContracts.map((contract) => registrationFromContract(contract)));
  registry.registerMany(
    studioSurfaceAssetDefinitions
      .map((definition) => definition as StudioAssetDefinition<unknown, StudioEmbeddedEvent>)
      .map((definition) => registrationFromDefinition(definition)),
  );
  return registry;
}
