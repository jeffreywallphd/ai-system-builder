import { describe, expect, it } from "bun:test";
import {
  createInitialImageManipulationSelectionState,
  getSelectionRecordIdForRole,
  reconcileImageManipulationSelection,
  setRoleSelection,
} from "../image-manipulation/ImageManipulationSelectionState";

describe("ImageManipulationSelectionState", () => {
  it("keeps role-aware selections synchronized to available records", () => {
    const initial = createInitialImageManipulationSelectionState();
    const selectedSource = setRoleSelection(initial, {
      role: "source",
      recordId: "source-2",
      syncPreviewRole: true,
    });

    const reconciled = reconcileImageManipulationSelection(selectedSource, {
      sourceRecordIds: ["source-1", "source-2"],
      outputRecordIds: ["output-1"],
      referenceRecordIds: ["reference-1"],
    });

    expect(reconciled.activePreviewRole).toBe("source");
    expect(getSelectionRecordIdForRole(reconciled, "source")).toBe("source-2");
    expect(getSelectionRecordIdForRole(reconciled, "output")).toBe("output-1");
    expect(getSelectionRecordIdForRole(reconciled, "reference")).toBe("reference-1");
  });

  it("falls back to an available role when the active preview role has no items", () => {
    const initial = setRoleSelection(createInitialImageManipulationSelectionState(), {
      role: "reference",
      recordId: "reference-2",
      syncPreviewRole: true,
    });

    const reconciled = reconcileImageManipulationSelection(initial, {
      sourceRecordIds: ["source-1"],
      outputRecordIds: ["output-1"],
      referenceRecordIds: [],
    });

    expect(reconciled.activePreviewRole).toBe("output");
    expect(reconciled.referenceRecordId).toBeUndefined();
  });
});
