import {
  ExperienceAssetModeIds,
  type ExperienceAssetModeDefinition,
  type ExperienceAssetModeId,
} from "./ExperienceAssetContracts";

export const ExperienceSurfaceAssetIds = Object.freeze({
  loomWizard: "loom-wizard",
  loomCanvas: "loom-canvas",
});

export type ExperienceSurfaceAssetId =
  typeof ExperienceSurfaceAssetIds[keyof typeof ExperienceSurfaceAssetIds];

export interface ExperienceSurfaceAssetRegistration {
  readonly id: ExperienceSurfaceAssetId;
  readonly modeId: ExperienceAssetModeId;
  readonly title: string;
  readonly summary: string;
  readonly intent: "guided-authoring" | "graph-authoring";
}

function normalizeRegistration(
  registration: ExperienceSurfaceAssetRegistration,
): ExperienceSurfaceAssetRegistration {
  const id = registration.id.trim() as ExperienceSurfaceAssetId;
  if (!id) {
    throw new Error("Experience surface asset id is required.");
  }

  const title = registration.title.trim();
  if (!title) {
    throw new Error(`Experience surface asset '${id}' title is required.`);
  }

  const summary = registration.summary.trim();
  if (!summary) {
    throw new Error(`Experience surface asset '${id}' summary is required.`);
  }

  return Object.freeze({
    ...registration,
    id,
    title,
    summary,
  });
}

export class ExperienceSurfaceAssetRegistry {
  private readonly byId = new Map<ExperienceSurfaceAssetId, ExperienceSurfaceAssetRegistration>();

  public register(registration: ExperienceSurfaceAssetRegistration): void {
    const normalized = normalizeRegistration(registration);
    if (this.byId.has(normalized.id)) {
      throw new Error(`Experience surface asset '${normalized.id}' is already registered.`);
    }
    this.byId.set(normalized.id, normalized);
  }

  public registerMany(registrations: ReadonlyArray<ExperienceSurfaceAssetRegistration>): void {
    for (const registration of registrations) {
      this.register(registration);
    }
  }

  public get(id: ExperienceSurfaceAssetId): ExperienceSurfaceAssetRegistration | undefined {
    return this.byId.get(id);
  }

  public list(): ReadonlyArray<ExperienceSurfaceAssetRegistration> {
    return Object.freeze(
      [...this.byId.values()].sort((left, right) => left.id.localeCompare(right.id)),
    );
  }
}

export const defaultExperienceSurfaceAssets: ReadonlyArray<ExperienceSurfaceAssetRegistration> = Object.freeze([
  Object.freeze({
    id: ExperienceSurfaceAssetIds.loomWizard,
    modeId: ExperienceAssetModeIds.wizard,
    title: "Wizard",
    summary: "Guided step-by-step authoring experience asset.",
    intent: "guided-authoring",
  }),
  Object.freeze({
    id: ExperienceSurfaceAssetIds.loomCanvas,
    modeId: ExperienceAssetModeIds.canvas,
    title: "Canvas",
    summary: "Graph-oriented authoring experience asset.",
    intent: "graph-authoring",
  }),
]);

export function createDefaultExperienceSurfaceAssetRegistry(): ExperienceSurfaceAssetRegistry {
  const registry = new ExperienceSurfaceAssetRegistry();
  registry.registerMany(defaultExperienceSurfaceAssets);
  return registry;
}

export interface DraftAuthoringSurfaceConfiguration {
  readonly wizard?: boolean;
  readonly canvas?: boolean;
}

export function resolveDraftAuthoringExperienceAssetIds(input: {
  readonly explicitAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly surfaces?: DraftAuthoringSurfaceConfiguration;
  readonly defaultAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
}): ReadonlyArray<ExperienceSurfaceAssetId> {
  if (input.explicitAssetIds) {
    return Object.freeze([...input.explicitAssetIds]);
  }

  if (input.surfaces) {
    const surfaceAssetIds: ExperienceSurfaceAssetId[] = [];
    if (input.surfaces.wizard) {
      surfaceAssetIds.push(ExperienceSurfaceAssetIds.loomWizard);
    }
    if (input.surfaces.canvas) {
      surfaceAssetIds.push(ExperienceSurfaceAssetIds.loomCanvas);
    }
    return Object.freeze(surfaceAssetIds);
  }

  return Object.freeze(
    [...(input.defaultAssetIds ?? [
      ExperienceSurfaceAssetIds.loomWizard,
      ExperienceSurfaceAssetIds.loomCanvas,
    ])],
  );
}

export function resolveExperienceAssetModesFromRegistrations(input: {
  readonly assetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly fallbackModes?: ReadonlyArray<ExperienceAssetModeDefinition>;
}): ReadonlyArray<ExperienceAssetModeDefinition> {
  const registry = createDefaultExperienceSurfaceAssetRegistry();
  const requestedIds = input.assetIds ?? Object.freeze([
    ExperienceSurfaceAssetIds.loomWizard,
    ExperienceSurfaceAssetIds.loomCanvas,
  ]);

  const modes = requestedIds
    .map((assetId) => registry.get(assetId))
    .filter((asset): asset is ExperienceSurfaceAssetRegistration => Boolean(asset))
    .map((asset) => Object.freeze({
      id: asset.modeId,
      title: asset.title,
      summary: asset.summary,
      intent: asset.intent,
    } satisfies ExperienceAssetModeDefinition));

  if (modes.length > 0) {
    return Object.freeze(modes);
  }

  return input.fallbackModes ?? Object.freeze([]);
}
