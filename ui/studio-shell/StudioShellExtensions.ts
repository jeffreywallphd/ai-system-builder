import type { ReactNode } from "react";
import type { AssetDraftDependencyReference, AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import { TaxonomySemanticRoles, type TaxonomyBehaviorKind, type TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import type { StudioShellSnapshotReadModel, StudioShellValidationIssue } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";

export const StudioShellExtensionSlots = Object.freeze({
  sessionContext: "session-context",
  draftAuthoring: "draft-authoring",
  metadata: "metadata",
  dependencies: "dependencies",
  lifecycle: "lifecycle",
  validation: "validation",
});

export type StudioShellExtensionSlot = typeof StudioShellExtensionSlots[keyof typeof StudioShellExtensionSlots];

export interface StudioShellExtensionContext {
  readonly studioId: string;
  readonly snapshot: StudioShellSnapshotReadModel | undefined;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly operationError?: string;
  readonly isBusy: boolean;
}

export interface StudioShellExtensionContribution {
  readonly id: string;
  readonly slot: StudioShellExtensionSlot;
  readonly title: string;
  readonly subtitle?: string;
  readonly order?: number;
  render(context: StudioShellExtensionContext): ReactNode;
}

export const StudioRegistrationKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
});

export type StudioRegistrationKind = typeof StudioRegistrationKinds[keyof typeof StudioRegistrationKinds];

type AtomicStudioRole = Extract<
  TaxonomySemanticRole,
  | "model"
  | "dataset"
  | "tool"
  | "prompt-template"
  | "embedding-index"
  | "config-profile"
>;

type CompositeStudioRole = Extract<
  TaxonomySemanticRole,
  | "workflow"
  | "context-bundle"
  | "dataset-pipeline"
  | "training-recipe"
  | "tool-chain"
>;

export interface StudioDraftDefaults {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly contentTemplate?: string;
  readonly metadataPatch?: AssetMetadataPatch;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface StudioShellPresentationHints {
  readonly title?: string;
  readonly subtitle?: string;
}

interface BaseStudioRegistration {
  readonly studioType: string;
  readonly studioId: string;
  readonly displayName: string;
  readonly defaults: StudioDraftDefaults;
  readonly extensions?: ReadonlyArray<StudioShellExtensionContribution>;
  readonly shell?: StudioShellPresentationHints;
}

export interface AtomicStudioRegistration extends BaseStudioRegistration {
  readonly kind: "atomic";
  readonly role: AtomicStudioRole;
  readonly allowedBehaviorKinds: ReadonlyArray<Extract<TaxonomyBehaviorKind, "none" | "conditional" | "deterministic">>;
}

export interface CompositeStudioRegistration extends BaseStudioRegistration {
  readonly kind: "composite";
  readonly role: CompositeStudioRole;
  readonly allowedBehaviorKinds: ReadonlyArray<Extract<TaxonomyBehaviorKind, "none" | "conditional" | "deterministic" | "iterative">>;
}

export type StudioRegistration = AtomicStudioRegistration | CompositeStudioRegistration;

function assertAtomicRole(role: TaxonomySemanticRole): AtomicStudioRole {
  const allowed = new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.model,
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.tool,
    TaxonomySemanticRoles.promptTemplate,
    TaxonomySemanticRoles.embeddingIndex,
    TaxonomySemanticRoles.configProfile,
  ]);
  if (!allowed.has(role)) {
    throw new Error(`Atomic studio role '${role}' is not supported.`);
  }
  return role as AtomicStudioRole;
}

function assertCompositeRole(role: TaxonomySemanticRole): CompositeStudioRole {
  const allowed = new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.workflow,
    TaxonomySemanticRoles.contextBundle,
    TaxonomySemanticRoles.datasetPipeline,
    TaxonomySemanticRoles.trainingRecipe,
    TaxonomySemanticRoles.toolChain,
  ]);
  if (!allowed.has(role)) {
    throw new Error(`Composite studio role '${role}' is not supported.`);
  }
  return role as CompositeStudioRole;
}

function normalizeRegistration(registration: StudioRegistration): StudioRegistration {
  const studioType = registration.studioType.trim();
  if (!studioType) {
    throw new Error("Studio registration studioType is required.");
  }

  const studioId = registration.studioId.trim();
  if (!studioId) {
    throw new Error(`Studio '${studioType}' studioId is required.`);
  }

  if (!registration.defaults.title.trim()) {
    throw new Error(`Studio '${studioType}' defaults.title is required.`);
  }

  if (registration.allowedBehaviorKinds.length === 0) {
    throw new Error(`Studio '${studioType}' must declare at least one allowed behavior kind.`);
  }

  if (registration.kind === StudioRegistrationKinds.atomic) {
    return Object.freeze({
      ...registration,
      studioType,
      studioId,
      role: assertAtomicRole(registration.role),
      allowedBehaviorKinds: Object.freeze([...registration.allowedBehaviorKinds]),
      defaults: Object.freeze({
        ...registration.defaults,
        title: registration.defaults.title.trim(),
        tags: Object.freeze([...registration.defaults.tags]),
        contentTemplate: registration.defaults.contentTemplate,
        metadataPatch: registration.defaults.metadataPatch,
        dependencies: registration.defaults.dependencies,
      }),
      extensions: Object.freeze([...(registration.extensions ?? [])]),
      shell: registration.shell ? Object.freeze({ ...registration.shell }) : undefined,
    });
  }

  return Object.freeze({
    ...registration,
    studioType,
    studioId,
    role: assertCompositeRole(registration.role),
    allowedBehaviorKinds: Object.freeze([...registration.allowedBehaviorKinds]),
    defaults: Object.freeze({
      ...registration.defaults,
      title: registration.defaults.title.trim(),
      tags: Object.freeze([...registration.defaults.tags]),
      contentTemplate: registration.defaults.contentTemplate,
      metadataPatch: registration.defaults.metadataPatch,
      dependencies: registration.defaults.dependencies,
    }),
    extensions: Object.freeze([...(registration.extensions ?? [])]),
    shell: registration.shell ? Object.freeze({ ...registration.shell }) : undefined,
  });
}

export class StudioShellExtensionRegistry {
  private readonly byId = new Map<string, StudioShellExtensionContribution>();

  public register(contribution: StudioShellExtensionContribution): void {
    const id = contribution.id.trim();
    if (!id) {
      throw new Error("Studio shell extension id is required.");
    }
    if (this.byId.has(id)) {
      throw new Error(`Studio shell extension '${id}' is already registered.`);
    }
    this.byId.set(id, contribution);
  }

  public registerMany(contributions: ReadonlyArray<StudioShellExtensionContribution>): void {
    for (const contribution of contributions) {
      this.register(contribution);
    }
  }

  public listBySlot(slot: StudioShellExtensionSlot): ReadonlyArray<StudioShellExtensionContribution> {
    const entries = [...this.byId.values()]
      .filter((entry) => entry.slot === slot)
      .sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.id.localeCompare(right.id);
      });

    return Object.freeze(entries);
  }
}

export class StudioRegistrationRegistry {
  private readonly byStudioType = new Map<string, StudioRegistration>();

  public register(registration: StudioRegistration): void {
    const studioType = registration.studioType.trim();
    if (!studioType) {
      throw new Error("Studio registration studioType is required.");
    }
    if (this.byStudioType.has(studioType)) {
      throw new Error(`Studio '${studioType}' is already registered.`);
    }

    this.byStudioType.set(studioType, normalizeRegistration(registration));
  }

  public get(studioType: string): StudioRegistration | undefined {
    return this.byStudioType.get(studioType.trim());
  }

  public list(): ReadonlyArray<StudioRegistration> {
    return Object.freeze(
      [...this.byStudioType.values()].sort((left, right) => left.studioType.localeCompare(right.studioType)),
    );
  }

  public listByKind(kind: StudioRegistrationKind): ReadonlyArray<StudioRegistration> {
    return Object.freeze(this.list().filter((entry) => entry.kind === kind));
  }

  public listExtensionsBySlot(studioType: string, slot: StudioShellExtensionSlot): ReadonlyArray<StudioShellExtensionContribution> {
    const registration = this.get(studioType);
    if (!registration) {
      return Object.freeze([]);
    }

    const registry = new StudioShellExtensionRegistry();
    registry.registerMany(registration.extensions ?? []);
    return registry.listBySlot(slot);
  }
}

export class AtomicStudioRegistry {
  private readonly inner = new StudioRegistrationRegistry();

  public register(registration: AtomicStudioRegistration): void {
    this.inner.register(registration);
  }

  public get(studioType: string): AtomicStudioRegistration | undefined {
    const registration = this.inner.get(studioType);
    return registration?.kind === StudioRegistrationKinds.atomic ? registration : undefined;
  }

  public list(): ReadonlyArray<AtomicStudioRegistration> {
    return Object.freeze(this.inner.listByKind(StudioRegistrationKinds.atomic) as ReadonlyArray<AtomicStudioRegistration>);
  }

  public listExtensionsBySlot(studioType: string, slot: StudioShellExtensionSlot): ReadonlyArray<StudioShellExtensionContribution> {
    return this.inner.listExtensionsBySlot(studioType, slot);
  }
}
