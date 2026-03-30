import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  createEmptyWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowOutput,
  addWorkflowOutputs,
  getWorkflowOutputValidationMessages,
  removeWorkflowOutput,
  setWorkflowOutputFieldValue,
  setWorkflowOutputDestinationType,
  setWorkflowOutputFileName,
  setWorkflowOutputFormat,
  setWorkflowOutputRecordEntityName,
  setWorkflowOutputViewerPresentationMode,
  setWorkflowOutputViewerTitle,
  WorkflowOutputPresentationModes,
  workflowOutputTypeDefinitions,
} from "../WorkflowWizardOutputs";

describe("WorkflowWizardOutputs", () => {
  it("adds and removes outputs with stable identifiers", () => {
    const baseDraft = createEmptyWorkflowDraft();
    const first = addWorkflowOutput(baseDraft, WorkflowDraftOutputDestinationTypes.fileExport);
    const second = addWorkflowOutput(first.draft, WorkflowDraftOutputDestinationTypes.webViewer);
    const third = addWorkflowOutput(second.draft, WorkflowDraftOutputDestinationTypes.systemEntry);

    expect(first.added).toBeTrue();
    expect(second.added).toBeTrue();
    expect(third.added).toBeTrue();

    expect(third.draft.outputs.map((output) => output.id)).toEqual([
      first.outputId,
      second.outputId,
      third.outputId,
    ]);
    expect(third.draft.outputs.map((output) => output.order)).toEqual([1, 2, 3]);

    const removed = removeWorkflowOutput(third.draft, second.outputId);
    expect(removed.changed).toBe(true);
    expect(removed.draft.outputs.map((output) => output.id)).toEqual([first.outputId, third.outputId]);
    expect(removed.draft.outputs.map((output) => output.order)).toEqual([1, 2]);
  });

  it("supports multi-output addition and rejects malformed output add requests", () => {
    const added = addWorkflowOutputs(createEmptyWorkflowDraft(), [
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
      "",
      "future-output",
    ]);

    expect(added.addedOutputIds).toHaveLength(2);
    expect(added.draft.outputs.map((output) => output.destination.type)).toEqual([
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
    ]);
    expect(added.rejectedRequests.map((entry) => entry.destinationType)).toEqual([
      "",
      "future-output",
    ]);
    expect(added.rejectedRequests[0]?.error).toContain("requires a destination type");
    expect(added.rejectedRequests[1]?.error).toContain("not supported");
  });

  it("switches output destination type and resets stale destination-specific configuration", () => {
    const added = addWorkflowOutput(createEmptyWorkflowDraft(), WorkflowDraftOutputDestinationTypes.fileExport);
    const outputId = added.outputId;

    const configuredFile = setWorkflowOutputFileName(added.draft, outputId, "report-name").draft;
    expect(configuredFile.outputs[0]?.destination.options).toEqual(expect.objectContaining({
      fileName: "report-name",
    }));

    const switched = setWorkflowOutputDestinationType(
      configuredFile,
      outputId,
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ).draft;

    expect(switched.outputs[0]?.destination.type).toBe(WorkflowDraftOutputDestinationTypes.systemEntry);
    expect(switched.outputs[0]?.destination.options).toEqual(expect.objectContaining({
      entityName: "",
      destinationConfig: "",
    }));
    expect(switched.outputs[0]?.destination.options).not.toEqual(expect.objectContaining({
      fileName: "report-name",
    }));
  });

  it("updates type-specific configuration fields independently", () => {
    const added = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.webViewer,
    );
    let draft = added.draft;
    draft = setWorkflowOutputViewerTitle(draft, added.outputId, "Viewer A").draft;
    draft = setWorkflowOutputViewerPresentationMode(draft, added.outputId, WorkflowOutputPresentationModes.fullPage).draft;

    expect(draft.outputs[0]?.title).toBe("Viewer A");
    expect(draft.outputs[0]?.configuration).toEqual(expect.objectContaining({
      title: "Viewer A",
    }));
    expect(draft.outputs[0]?.destination.options).toEqual(expect.objectContaining({
      presentationMode: WorkflowOutputPresentationModes.fullPage,
    }));
  });

  it("returns validation messages for missing required per-type configuration", () => {
    const fileOutput = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.fileExport,
    ).draft.outputs[0]!;
    const invalidFile = {
      ...fileOutput,
      format: "invalid-format",
    };
    expect(getWorkflowOutputValidationMessages(invalidFile)).toContain("File Export output requires a valid file format.");

    const webViewerOutput = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.webViewer,
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(webViewerOutput)).toContain("Web Viewer output requires a viewer title.");

    const systemOutput = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(systemOutput)).toContain(
      "Database/System Record output requires an entity name.",
    );

    const configuredSystem = setWorkflowOutputRecordEntityName(
      { ...createEmptyWorkflowDraft(), outputs: [systemOutput] },
      systemOutput.id,
      "customer-record",
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(configuredSystem)).toEqual([]);
  });

  it("applies explicit output format updates for file-export outputs", () => {
    const added = addWorkflowOutput(createEmptyWorkflowDraft(), WorkflowDraftOutputDestinationTypes.fileExport);
    const updated = setWorkflowOutputFormat(added.draft, added.outputId, "pdf");
    expect(updated.changed).toBe(false);

    const switched = setWorkflowOutputFormat(added.draft, added.outputId, "json");
    expect(switched.changed).toBe(true);
    expect(switched.draft.outputs[0]?.format).toBe("json");
  });

  it("ignores unsupported destination-type switches", () => {
    const added = addWorkflowOutput(createEmptyWorkflowDraft(), WorkflowDraftOutputDestinationTypes.fileExport);
    const unchanged = setWorkflowOutputDestinationType(added.draft, added.outputId as string, "future-output");
    expect(unchanged.changed).toBe(false);
    expect(unchanged.draft.outputs[0]?.destination.type).toBe(WorkflowDraftOutputDestinationTypes.fileExport);
  });

  it("applies registry-driven field updates for format and destination configuration keys", () => {
    const fileDefinition = workflowOutputTypeDefinitions.find(
      (entry) => entry.destinationType === WorkflowDraftOutputDestinationTypes.fileExport,
    );
    const systemDefinition = workflowOutputTypeDefinitions.find(
      (entry) => entry.destinationType === WorkflowDraftOutputDestinationTypes.systemEntry,
    );
    if (!fileDefinition || !systemDefinition) {
      throw new Error("Expected workflow output type definitions to be available.");
    }

    const added = addWorkflowOutputs(createEmptyWorkflowDraft(), [
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ]);
    const fileOutputId = added.draft.outputs[0]?.id as string;
    const systemOutputId = added.draft.outputs[1]?.id as string;
    const formatField = fileDefinition.configurationFields.find((field) => field.key === "format");
    const entityField = systemDefinition.configurationFields.find((field) => field.key === "entityName");
    if (!formatField || !entityField) {
      throw new Error("Expected output config fields to be available.");
    }

    let draft = setWorkflowOutputFieldValue(added.draft, fileOutputId, formatField, "jsonl").draft;
    draft = setWorkflowOutputFieldValue(draft, systemOutputId, entityField, "customer-record").draft;

    expect(draft.outputs[0]?.format).toBe("jsonl");
    expect(draft.outputs[1]?.destination.options).toEqual(expect.objectContaining({
      entityName: "customer-record",
    }));
  });
});
