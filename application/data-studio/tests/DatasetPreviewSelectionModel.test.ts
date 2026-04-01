import { describe, expect, it } from "bun:test";
import { DatasetPreviewSelectionModes, DatasetPreviewSelectionState } from "../DatasetPreviewSelectionModel";
import type { ImageDatasetPreviewItem } from "../ImageDatasetPreviewBuilder";

function item(id: string): ImageDatasetPreviewItem {
  return Object.freeze({
    itemId: id,
    selectionId: id,
    metadataSummary: Object.freeze({}),
    tags: Object.freeze([]),
    annotations: Object.freeze({}),
    derived: Object.freeze({}),
    issues: Object.freeze([]),
  });
}

describe("DatasetPreviewSelectionState", () => {
  it("supports multi-select toggling with stable selection identifiers", () => {
    const state = new DatasetPreviewSelectionState("asset:dataset:images", DatasetPreviewSelectionModes.multi);
    state.toggle(item("record-1"));
    const snapshot = state.toggle(item("record-2"));

    expect(snapshot.datasetAssetId).toBe("asset:dataset:images");
    expect(snapshot.selectedSelectionIds).toEqual(["record-1", "record-2"]);
    expect(snapshot.selectedRecords.map((record) => record.recordId)).toEqual(["record-1", "record-2"]);
    expect(snapshot.selectedRecords[0]?.dataset.assetId).toBe("asset:dataset:images");
  });

  it("enforces single-select mode", () => {
    const state = new DatasetPreviewSelectionState("asset:dataset:images", DatasetPreviewSelectionModes.single);
    state.toggle(item("record-1"));
    const snapshot = state.toggle(item("record-2"));

    expect(snapshot.selectedSelectionIds).toEqual(["record-2"]);
  });

  it("syncs window records and drops stale selections", () => {
    const state = new DatasetPreviewSelectionState("asset:dataset:images", DatasetPreviewSelectionModes.multi);
    state.toggle(item("record-1"));
    state.toggle(item("record-2"));

    const snapshot = state.syncWithWindow([item("record-2"), item("record-3")]);
    expect(snapshot.selectedSelectionIds).toEqual(["record-2"]);
  });
});
