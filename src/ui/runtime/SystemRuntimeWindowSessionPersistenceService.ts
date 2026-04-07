import type { ComfyImageManipulationConfig } from "@application/system-studio/ComfyImageManipulationPropertySchema";
import type { SystemRuntimeWindowLaunchContract } from "@application/system-runtime/SystemRuntimeWindowLaunchContract";
import type {
  ImageManipulationSelectionSnapshot,
} from "./ImageManipulationRuntimeDatasetBindingService";
import type { SystemRuntimeHydratedState } from "./SystemRuntimeWindowHydrationService";

export const RuntimeWindowSessionPersistenceVersion = "1.0.0";
const RuntimeWindowSessionStorageKeyPrefix = "ai-loom.runtime-window.session";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RuntimeWindowSessionScope {
  readonly studioId: string;
  readonly draftId?: string;
  readonly targetKind: "standalone-system" | "embedded-subsystem";
  readonly systemAssetId: string;
  readonly subsystemId?: string;
  readonly pageBindingId: string;
}

export interface RuntimeWindowResolvedPageContext {
  readonly systemAssetId: string;
  readonly pageBindingId: string;
  readonly pageId?: string;
  readonly pageTitle?: string;
  readonly workflowTemplateAssetId?: string;
  readonly workflowTemplateVersionId?: string;
  readonly datasetBindingIds: ReadonlyArray<string>;
}

export interface RuntimeWindowSessionSelectionState extends ImageManipulationSelectionSnapshot {}

export interface RuntimeWindowSessionPanelState {
  readonly runAdvancedDetailsOpen: boolean;
}

export interface RuntimeWindowSessionPropertyState {
  readonly presetId: string;
  readonly config: ComfyImageManipulationConfig;
}

export interface RuntimeWindowSessionState {
  readonly schemaVersion: typeof RuntimeWindowSessionPersistenceVersion;
  readonly scope: RuntimeWindowSessionScope;
  readonly launch: {
    readonly launchId: string;
    readonly runtimeSessionId?: string;
    readonly restoredFromLaunchId?: string;
  };
  readonly resolvedPage: RuntimeWindowResolvedPageContext;
  readonly property: RuntimeWindowSessionPropertyState;
  readonly selection: RuntimeWindowSessionSelectionState;
  readonly panelState: RuntimeWindowSessionPanelState;
  readonly updatedAt: string;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class SystemRuntimeWindowSessionPersistenceService {
  public constructor(
    private readonly storage: StorageLike | undefined = typeof window !== "undefined"
      ? window.localStorage
      : undefined,
  ) {}

  public resolveScope(input: {
    readonly launch: SystemRuntimeWindowLaunchContract;
    readonly hydratedRuntime?: SystemRuntimeHydratedState;
    readonly draftId?: string;
  }): RuntimeWindowSessionScope {
    return Object.freeze({
      studioId: input.launch.resolution.studioId,
      draftId: input.launch.resolution.draftId ?? input.draftId,
      targetKind: input.launch.launchTarget.targetKind,
      systemAssetId: input.hydratedRuntime?.resolvedSystemAsset.assetId ?? input.launch.launchTarget.systemAssetId,
      subsystemId: input.hydratedRuntime?.resolvedSystemAsset.subsystemId ?? input.launch.launchTarget.subsystemId,
      pageBindingId: input.hydratedRuntime?.resolvedPage.pageBindingId ?? input.launch.launchTarget.pageBindingId,
    });
  }

  public resolveStorageKey(scope: RuntimeWindowSessionScope): string {
    return [
      RuntimeWindowSessionStorageKeyPrefix,
      RuntimeWindowSessionPersistenceVersion,
      scope.studioId,
      scope.draftId ?? "draft",
      scope.targetKind,
      scope.systemAssetId,
      scope.subsystemId ?? "root",
      scope.pageBindingId,
    ].join(":");
  }

  public save(state: RuntimeWindowSessionState): void {
    if (!this.storage) {
      return;
    }
    this.storage.setItem(this.resolveStorageKey(state.scope), JSON.stringify(state));
  }

  public load(scope: RuntimeWindowSessionScope): RuntimeWindowSessionState | undefined {
    if (!this.storage) {
      return undefined;
    }
    const serialized = this.storage.getItem(this.resolveStorageKey(scope));
    if (!serialized) {
      return undefined;
    }
    try {
      return this.parseState(JSON.parse(serialized), scope);
    } catch {
      return undefined;
    }
  }

  private parseState(raw: unknown, expectedScope: RuntimeWindowSessionScope): RuntimeWindowSessionState | undefined {
    if (!isRecord(raw)) {
      return undefined;
    }
    if (raw.schemaVersion !== RuntimeWindowSessionPersistenceVersion) {
      return undefined;
    }

    const scope = this.parseScope(raw.scope);
    if (!scope) {
      return undefined;
    }
    if (this.resolveStorageKey(scope) !== this.resolveStorageKey(expectedScope)) {
      return undefined;
    }

    const launch = isRecord(raw.launch)
      ? Object.freeze({
        launchId: normalizeOptionalString(raw.launch.launchId) ?? "",
        runtimeSessionId: normalizeOptionalString(raw.launch.runtimeSessionId),
        restoredFromLaunchId: normalizeOptionalString(raw.launch.restoredFromLaunchId),
      })
      : undefined;
    if (!launch?.launchId) {
      return undefined;
    }

    const property = isRecord(raw.property)
      ? Object.freeze({
        presetId: normalizeOptionalString(raw.property.presetId) ?? "",
        config: raw.property.config as ComfyImageManipulationConfig,
      })
      : undefined;
    if (!property?.presetId || !property.config) {
      return undefined;
    }

    const selection = this.parseSelection(raw.selection);
    if (!selection) {
      return undefined;
    }

    const panelState = isRecord(raw.panelState)
      ? Object.freeze({
        runAdvancedDetailsOpen: raw.panelState.runAdvancedDetailsOpen === true,
      })
      : Object.freeze({
        runAdvancedDetailsOpen: false,
      });

    const resolvedPage = this.parseResolvedPage(raw.resolvedPage);
    if (!resolvedPage) {
      return undefined;
    }

    return Object.freeze({
      schemaVersion: RuntimeWindowSessionPersistenceVersion,
      scope,
      launch,
      resolvedPage,
      property,
      selection,
      panelState,
      updatedAt: normalizeOptionalString(raw.updatedAt) ?? new Date().toISOString(),
    });
  }

  private parseScope(raw: unknown): RuntimeWindowSessionScope | undefined {
    if (!isRecord(raw)) {
      return undefined;
    }
    const studioId = normalizeOptionalString(raw.studioId);
    const targetKind = raw.targetKind === "standalone-system" || raw.targetKind === "embedded-subsystem"
      ? raw.targetKind
      : undefined;
    const systemAssetId = normalizeOptionalString(raw.systemAssetId);
    const pageBindingId = normalizeOptionalString(raw.pageBindingId);
    if (!studioId || !targetKind || !systemAssetId || !pageBindingId) {
      return undefined;
    }
    return Object.freeze({
      studioId,
      draftId: normalizeOptionalString(raw.draftId),
      targetKind,
      systemAssetId,
      subsystemId: normalizeOptionalString(raw.subsystemId),
      pageBindingId,
    });
  }

  private parseSelection(raw: unknown): RuntimeWindowSessionSelectionState | undefined {
    if (!isRecord(raw)) {
      return undefined;
    }
    const activePreviewRole = raw.activePreviewRole === "source"
      || raw.activePreviewRole === "output"
      || raw.activePreviewRole === "reference"
      ? raw.activePreviewRole
      : undefined;
    if (!activePreviewRole) {
      return undefined;
    }
    const selectedRecordIdsRaw = isRecord(raw.selectedRecordIds) ? raw.selectedRecordIds : {};
    const selectedRecordIds: Record<string, string> = {};
    for (const [bindingId, value] of Object.entries(selectedRecordIdsRaw)) {
      const normalizedBindingId = bindingId.trim();
      const normalizedRecordId = normalizeOptionalString(value);
      if (!normalizedBindingId || !normalizedRecordId) {
        continue;
      }
      selectedRecordIds[normalizedBindingId] = normalizedRecordId;
    }

    const gallerySelectionRecordIds = Array.isArray(raw.gallerySelectionRecordIds)
      ? Object.freeze(raw.gallerySelectionRecordIds
        .map((entry) => normalizeOptionalString(entry))
        .filter((entry): entry is string => Boolean(entry)))
      : Object.freeze([]);

    return Object.freeze({
      selectedDatasetBindingId: normalizeOptionalString(raw.selectedDatasetBindingId),
      activePreviewRole,
      selectedRecordIds: Object.freeze(selectedRecordIds),
      gallerySelectionRecordIds,
    });
  }

  private parseResolvedPage(raw: unknown): RuntimeWindowResolvedPageContext | undefined {
    if (!isRecord(raw)) {
      return undefined;
    }
    const systemAssetId = normalizeOptionalString(raw.systemAssetId);
    const pageBindingId = normalizeOptionalString(raw.pageBindingId);
    if (!systemAssetId || !pageBindingId) {
      return undefined;
    }
    const datasetBindingIds = Array.isArray(raw.datasetBindingIds)
      ? Object.freeze(raw.datasetBindingIds
        .map((entry) => normalizeOptionalString(entry))
        .filter((entry): entry is string => Boolean(entry)))
      : Object.freeze([]);

    return Object.freeze({
      systemAssetId,
      pageBindingId,
      pageId: normalizeOptionalString(raw.pageId),
      pageTitle: normalizeOptionalString(raw.pageTitle),
      workflowTemplateAssetId: normalizeOptionalString(raw.workflowTemplateAssetId),
      workflowTemplateVersionId: normalizeOptionalString(raw.workflowTemplateVersionId),
      datasetBindingIds,
    });
  }
}

