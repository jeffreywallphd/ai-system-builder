import type { OutputGalleryItem } from "../../application/system-runtime/OutputGalleryDataContract";
import {
  createInitialImageManipulationSelectionState,
  reconcileImageManipulationSelection,
  setActivePreviewRole,
  type ImageManipulationSelectionRole,
  type ImageManipulationSelectionState,
} from "../components/studio-shell/image-manipulation/ImageManipulationSelectionState";
import type {
  HydratedRuntimeDatasetBinding,
  HydratedRuntimeSelectionState,
} from "./SystemRuntimeWindowHydrationService";

export interface ImageManipulationRoleBindings {
  readonly sourceBindingId: string;
  readonly outputBindingId: string;
  readonly referenceBindingId?: string;
}

export interface ImageManipulationCollectionsByRole {
  readonly sourceItems: ReadonlyArray<OutputGalleryItem>;
  readonly outputItems: ReadonlyArray<OutputGalleryItem>;
  readonly referenceItems: ReadonlyArray<OutputGalleryItem>;
}

export interface ImageManipulationSelectionSnapshot {
  readonly selectedDatasetBindingId?: string;
  readonly activePreviewRole: ImageManipulationSelectionRole;
  readonly selectedRecordIds: Readonly<Record<string, string>>;
  readonly gallerySelectionRecordIds: ReadonlyArray<string>;
}

export interface ReconcileImageManipulationBindingSelectionInput {
  readonly current?: ImageManipulationSelectionState;
  readonly roleBindings: ImageManipulationRoleBindings;
  readonly hydratedSelection: HydratedRuntimeSelectionState;
  readonly collections: ImageManipulationCollectionsByRole;
  readonly preferLatestOutput?: boolean;
}

export interface ReconcileImageManipulationBindingSelectionResult {
  readonly selection: ImageManipulationSelectionState;
  readonly serializedSelection: ImageManipulationSelectionSnapshot;
}

function toRole(binding: HydratedRuntimeDatasetBinding): ImageManipulationSelectionRole | undefined {
  if (binding.role === "input") {
    return "source";
  }
  if (binding.role === "output") {
    return "output";
  }
  if (binding.role === "reference") {
    return "reference";
  }
  return undefined;
}

function toRecordIds(items: ReadonlyArray<OutputGalleryItem>): ReadonlyArray<string> {
  return Object.freeze(items.map((item) => item.image.recordId));
}

function normalizePreviewRole(value: string | undefined): ImageManipulationSelectionRole {
  return value === "source" || value === "output" || value === "reference"
    ? value
    : "output";
}

function getRoleRecordId(selection: ImageManipulationSelectionState, role: ImageManipulationSelectionRole): string | undefined {
  if (role === "source") {
    return selection.sourceRecordId;
  }
  if (role === "reference") {
    return selection.referenceRecordId;
  }
  return selection.outputRecordId;
}

export class ImageManipulationRuntimeDatasetBindingService {
  public resolveRoleBindings(datasetBindings: ReadonlyArray<HydratedRuntimeDatasetBinding>): ImageManipulationRoleBindings {
    const byRole = new Map<ImageManipulationSelectionRole, HydratedRuntimeDatasetBinding>();
    for (const binding of datasetBindings) {
      const role = toRole(binding);
      if (!role || byRole.has(role)) {
        continue;
      }
      byRole.set(role, binding);
    }
    return Object.freeze({
      sourceBindingId: byRole.get("source")?.bindingId ?? "input-image-dataset",
      outputBindingId: byRole.get("output")?.bindingId ?? "output-image-dataset",
      referenceBindingId: byRole.get("reference")?.bindingId,
    });
  }

  public createSelectionStateFromHydration(input: {
    readonly roleBindings: ImageManipulationRoleBindings;
    readonly hydratedSelection: HydratedRuntimeSelectionState;
  }): ImageManipulationSelectionState {
    const sourceRecordId = input.hydratedSelection.selectedRecordIds[input.roleBindings.sourceBindingId];
    const outputRecordId = input.hydratedSelection.selectedRecordIds[input.roleBindings.outputBindingId];
    const referenceRecordId = input.roleBindings.referenceBindingId
      ? input.hydratedSelection.selectedRecordIds[input.roleBindings.referenceBindingId]
      : undefined;
    return Object.freeze({
      activePreviewRole: normalizePreviewRole(input.hydratedSelection.activePreviewRole),
      sourceRecordId,
      outputRecordId,
      referenceRecordId,
    });
  }

  public reconcileSelection(input: ReconcileImageManipulationBindingSelectionInput): ReconcileImageManipulationBindingSelectionResult {
    const current = input.current
      ?? this.createSelectionStateFromHydration({
        roleBindings: input.roleBindings,
        hydratedSelection: input.hydratedSelection,
      });
    const selection = reconcileImageManipulationSelection(current, {
      sourceRecordIds: toRecordIds(input.collections.sourceItems),
      outputRecordIds: toRecordIds(input.collections.outputItems),
      referenceRecordIds: toRecordIds(input.collections.referenceItems),
      preferredSourceRecordId: input.hydratedSelection.selectedRecordIds[input.roleBindings.sourceBindingId],
      preferredOutputRecordId: input.preferLatestOutput
        ? input.collections.outputItems[0]?.image.recordId
        : input.hydratedSelection.selectedRecordIds[input.roleBindings.outputBindingId],
      preferredReferenceRecordId: input.roleBindings.referenceBindingId
        ? input.hydratedSelection.selectedRecordIds[input.roleBindings.referenceBindingId]
        : undefined,
    });

    const withPreviewRole = setActivePreviewRole(
      selection,
      normalizePreviewRole(input.hydratedSelection.activePreviewRole),
    );

    const selectedDatasetBindingId = input.hydratedSelection.selectedDatasetBindingId
      ?? (withPreviewRole.activePreviewRole === "source"
        ? input.roleBindings.sourceBindingId
        : withPreviewRole.activePreviewRole === "reference"
          ? input.roleBindings.referenceBindingId
          : input.roleBindings.outputBindingId);
    const selectedRecordIds = Object.freeze({
      [input.roleBindings.sourceBindingId]: withPreviewRole.sourceRecordId ?? "",
      [input.roleBindings.outputBindingId]: withPreviewRole.outputRecordId ?? "",
      ...(input.roleBindings.referenceBindingId
        ? { [input.roleBindings.referenceBindingId]: withPreviewRole.referenceRecordId ?? "" }
        : {}),
    });
    const filteredSelectedRecordIds = Object.freeze(Object.fromEntries(
      Object.entries(selectedRecordIds).filter(([, value]) => value.trim().length > 0),
    ));

    const focusedRecordId = getRoleRecordId(withPreviewRole, withPreviewRole.activePreviewRole);
    const gallerySelectionRecordIds = focusedRecordId
      ? Object.freeze([focusedRecordId])
      : Object.freeze([]);

    return Object.freeze({
      selection: withPreviewRole,
      serializedSelection: Object.freeze({
        selectedDatasetBindingId,
        activePreviewRole: withPreviewRole.activePreviewRole,
        selectedRecordIds: filteredSelectedRecordIds,
        gallerySelectionRecordIds,
      }),
    });
  }

  public createEmptySelectionSnapshot(roleBindings: ImageManipulationRoleBindings): ImageManipulationSelectionSnapshot {
    const selection = createInitialImageManipulationSelectionState();
    return Object.freeze({
      selectedDatasetBindingId: roleBindings.outputBindingId,
      activePreviewRole: selection.activePreviewRole,
      selectedRecordIds: Object.freeze({}),
      gallerySelectionRecordIds: Object.freeze([]),
    });
  }
}

