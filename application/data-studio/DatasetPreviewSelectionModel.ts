import type { ImageDatasetPreviewItem } from "./ImageDatasetPreviewBuilder";

export const DatasetPreviewSelectionModes = Object.freeze({
  single: "single",
  multi: "multi",
} as const);

export type DatasetPreviewSelectionMode =
  typeof DatasetPreviewSelectionModes[keyof typeof DatasetPreviewSelectionModes];

export interface DatasetRecordSelectionReference {
  readonly datasetAssetId: string;
  readonly selectionId: string;
  readonly recordId: string;
  readonly imageReference?: string;
}

export interface DatasetPreviewSelectionSnapshot {
  readonly datasetAssetId: string;
  readonly mode: DatasetPreviewSelectionMode;
  readonly selectedSelectionIds: ReadonlyArray<string>;
  readonly selectedRecords: ReadonlyArray<DatasetRecordSelectionReference>;
}

function toSelectionReference(
  datasetAssetId: string,
  item: ImageDatasetPreviewItem,
): DatasetRecordSelectionReference {
  return Object.freeze({
    datasetAssetId,
    selectionId: item.selectionId,
    recordId: item.itemId,
    imageReference: item.imageReference,
  });
}

export class DatasetPreviewSelectionState {
  private readonly selectedById = new Map<string, DatasetRecordSelectionReference>();

  public constructor(
    private readonly datasetAssetId: string,
    private mode: DatasetPreviewSelectionMode = DatasetPreviewSelectionModes.multi,
  ) {}

  public toggle(item: ImageDatasetPreviewItem): DatasetPreviewSelectionSnapshot {
    const selection = toSelectionReference(this.datasetAssetId, item);
    if (this.mode === DatasetPreviewSelectionModes.single) {
      if (this.selectedById.has(selection.selectionId)) {
        this.selectedById.clear();
      } else {
        this.selectedById.clear();
        this.selectedById.set(selection.selectionId, selection);
      }
      return this.snapshot();
    }

    if (this.selectedById.has(selection.selectionId)) {
      this.selectedById.delete(selection.selectionId);
    } else {
      this.selectedById.set(selection.selectionId, selection);
    }
    return this.snapshot();
  }

  public setMode(mode: DatasetPreviewSelectionMode): DatasetPreviewSelectionSnapshot {
    this.mode = mode;
    if (mode === DatasetPreviewSelectionModes.single && this.selectedById.size > 1) {
      const first = this.selectedById.values().next().value;
      this.selectedById.clear();
      if (first) {
        this.selectedById.set(first.selectionId, first);
      }
    }
    return this.snapshot();
  }

  public syncWithWindow(items: ReadonlyArray<ImageDatasetPreviewItem>): DatasetPreviewSelectionSnapshot {
    const activeIds = new Set(items.map((item) => item.selectionId));
    for (const selectedId of [...this.selectedById.keys()]) {
      if (!activeIds.has(selectedId)) {
        this.selectedById.delete(selectedId);
      }
    }
    return this.snapshot();
  }

  public clear(): DatasetPreviewSelectionSnapshot {
    this.selectedById.clear();
    return this.snapshot();
  }

  public snapshot(): DatasetPreviewSelectionSnapshot {
    const selectedRecords = Object.freeze([...this.selectedById.values()]);
    return Object.freeze({
      datasetAssetId: this.datasetAssetId,
      mode: this.mode,
      selectedSelectionIds: Object.freeze(selectedRecords.map((record) => record.selectionId)),
      selectedRecords,
    });
  }
}
