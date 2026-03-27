import type { ReactNode } from "react";
import type { AssetDraftDependencyReference, AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import { TaxonomySemanticRoles, type TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
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

type AtomicStudioRole = Extract<
  TaxonomySemanticRole,
  | "model"
  | "dataset"
  | "tool"
  | "prompt-template"
  | "embedding-index"
  | "config-profile"
>;

export interface AtomicStudioDraftDefaults {
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly contentTemplate?: string;
  readonly metadataPatch?: AssetMetadataPatch;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface AtomicStudioRegistration {
  readonly studioType: string;
  readonly studioId: string;
  readonly displayName: string;
  readonly role: AtomicStudioRole;
  readonly defaults: AtomicStudioDraftDefaults;
  readonly extensions?: ReadonlyArray<StudioShellExtensionContribution>;
}

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

export class AtomicStudioRegistry {
  private readonly byStudioType = new Map<string, AtomicStudioRegistration>();

  public register(registration: AtomicStudioRegistration): void {
    const studioType = registration.studioType.trim();
    if (!studioType) {
      throw new Error("Atomic studio registration studioType is required.");
    }
    if (this.byStudioType.has(studioType)) {
      throw new Error(`Atomic studio '${studioType}' is already registered.`);
    }
    const studioId = registration.studioId.trim();
    if (!studioId) {
      throw new Error(`Atomic studio '${studioType}' studioId is required.`);
    }

    const defaults = registration.defaults;
    if (!defaults.title.trim()) {
      throw new Error(`Atomic studio '${studioType}' defaults.title is required.`);
    }

    this.byStudioType.set(studioType, Object.freeze({
      ...registration,
      studioType,
      studioId,
      role: assertAtomicRole(registration.role),
      defaults: Object.freeze({
        ...defaults,
        title: defaults.title.trim(),
        tags: Object.freeze([...defaults.tags]),
        contentTemplate: defaults.contentTemplate,
        metadataPatch: defaults.metadataPatch,
        dependencies: defaults.dependencies,
      }),
      extensions: Object.freeze([...(registration.extensions ?? [])]),
    }));
  }

  public get(studioType: string): AtomicStudioRegistration | undefined {
    return this.byStudioType.get(studioType.trim());
  }

  public list(): ReadonlyArray<AtomicStudioRegistration> {
    return Object.freeze(
      [...this.byStudioType.values()].sort((left, right) => left.studioType.localeCompare(right.studioType)),
    );
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
