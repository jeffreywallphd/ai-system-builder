import { describe, expect, it } from "bun:test";
import { createEmptyWorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyInlineDatasetReturnToDraft,
  listDatasetInputs,
  removeDatasetInputSelection,
  toggleDatasetInputSelection,
  upsertDatasetInputSelection,
} from "../WorkflowWizardDatasetInputs";

describe("WorkflowWizardDatasetInputs", () => {
  it("supports multi-select dataset additions and removal via toggle", () => {
    const baseDraft = createEmptyWorkflowDraft();
    const first = toggleDatasetInputSelection(baseDraft, {
      assetId: "asset:dataset-a",
      versionId: "asset:dataset-a:v1",
      name: "Dataset A",
    });
    const second = toggleDatasetInputSelection(first.draft, {
      assetId: "asset:dataset-b",
      versionId: "asset:dataset-b:v1",
      name: "Dataset B",
    });

    expect(first.selected).toBe(true);
    expect(second.selected).toBe(true);
    expect(listDatasetInputs(second.draft).map((entry) => entry.asset.assetId)).toEqual([
      "asset:dataset-a",
      "asset:dataset-b",
    ]);

    const removed = toggleDatasetInputSelection(second.draft, {
      assetId: "asset:dataset-a",
    });
    expect(removed.selected).toBe(false);
    expect(listDatasetInputs(removed.draft).map((entry) => entry.asset.assetId)).toEqual(["asset:dataset-b"]);
  });

  it("upserts returned inline dataset versions without duplicating asset selections", () => {
    const baseDraft = createEmptyWorkflowDraft();
    const firstAttach = upsertDatasetInputSelection(baseDraft, {
      assetId: "asset:dataset-returned",
    });
    expect(firstAttach.changed).toBe(true);
    expect(listDatasetInputs(firstAttach.draft)[0]?.asset.versionId).toBeUndefined();

    const secondAttach = upsertDatasetInputSelection(firstAttach.draft, {
      assetId: "asset:dataset-returned",
      versionId: "asset:dataset-returned:v2",
      name: "Returned Dataset",
    });
    expect(secondAttach.changed).toBe(true);
    expect(listDatasetInputs(secondAttach.draft)).toHaveLength(1);
    expect(listDatasetInputs(secondAttach.draft)[0]?.asset.versionId).toBe("asset:dataset-returned:v2");
    expect(listDatasetInputs(secondAttach.draft)[0]?.title).toBe("Returned Dataset");
  });

  it("removes selected dataset cleanly without affecting non-dataset inputs", () => {
    const baseDraft = createEmptyWorkflowDraft();
    const withDataset = upsertDatasetInputSelection(baseDraft, {
      assetId: "asset:dataset-c",
      versionId: "asset:dataset-c:v1",
    }).draft;
    const withRuntimeInput = Object.freeze({
      ...withDataset,
      inputs: Object.freeze([
        ...withDataset.inputs,
        Object.freeze({
          id: "input-runtime",
          type: "runtime-input",
          sourceType: "runtime-parameter" as const,
          parameterKey: "runtime-key",
        }),
      ]),
    });

    const removed = removeDatasetInputSelection(withRuntimeInput, "asset:dataset-c");
    expect(removed.changed).toBe(true);
    expect(listDatasetInputs(removed.draft)).toHaveLength(0);
    expect(removed.draft.inputs.some((entry) => entry.id === "input-runtime")).toBe(true);
  });

  it("ignores cancelled inline return payloads without mutating workflow inputs", () => {
    const baseDraft = createEmptyWorkflowDraft();
    const seeded = upsertDatasetInputSelection(baseDraft, {
      assetId: "asset:dataset-seeded",
      versionId: "asset:dataset-seeded:v1",
    }).draft;

    const result = applyInlineDatasetReturnToDraft(seeded, {
      status: "cancelled",
      assetId: "asset:dataset-new",
      versionId: "asset:dataset-new:v1",
    });

    expect(result.changed).toBe(false);
    expect(result.draft).toBe(seeded);
    expect(listDatasetInputs(result.draft).map((entry) => entry.asset.assetId)).toEqual(["asset:dataset-seeded"]);
  });
});
