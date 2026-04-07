import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  createEmptyWorkflowDraft,
} from "../../../../src/domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowOutput,
  addWorkflowOutputs,
  canMoveWorkflowOutput,
  getWorkflowOutputValidationMessages,
  moveWorkflowOutputDown,
  moveWorkflowOutputUp,
  removeWorkflowOutput,
  resolveWorkflowOutputSelectionId,
  listWorkflowOutputSummaries,
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

  it("reorders outputs deterministically and preserves contiguous output ordering", () => {
    const draft = addWorkflowOutputs(createEmptyWorkflowDraft(), [
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ]).draft;
    const secondId = draft.outputs[1]?.id as string;
    const thirdId = draft.outputs[2]?.id as string;

    expect(canMoveWorkflowOutput(draft, secondId, "up")).toBe(true);
    expect(canMoveWorkflowOutput(draft, secondId, "down")).toBe(true);
    expect(canMoveWorkflowOutput(draft, draft.outputs[0]?.id as string, "up")).toBe(false);
    expect(canMoveWorkflowOutput(draft, thirdId, "down")).toBe(false);

    const movedUp = moveWorkflowOutputUp(draft, thirdId);
    expect(movedUp.changed).toBe(true);
    expect(movedUp.draft.outputs.map((output) => output.id)).toEqual([
      draft.outputs[0]?.id,
      thirdId,
      secondId,
    ]);
    expect(movedUp.draft.outputs.map((output) => output.order)).toEqual([1, 2, 3]);

    const movedDown = moveWorkflowOutputDown(movedUp.draft, draft.outputs[0]?.id as string);
    expect(movedDown.changed).toBe(true);
    expect(movedDown.draft.outputs.map((output) => output.order)).toEqual([1, 2, 3]);
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

  it("resolves output selection id with stable fallback behavior", () => {
    const added = addWorkflowOutputs(createEmptyWorkflowDraft(), [
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
    ]).draft;
    const first = added.outputs[0]?.id as string;
    const second = added.outputs[1]?.id as string;

    expect(resolveWorkflowOutputSelectionId(added, second)).toBe(second);
    expect(resolveWorkflowOutputSelectionId(added, "missing")).toBe(first);
    expect(resolveWorkflowOutputSelectionId(createEmptyWorkflowDraft())).toBeUndefined();
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
      recordCollection: "",
      writeMode: "upsert",
      recordShape: "single-record",
      includeExecutionMetadata: "true",
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
    expect(getWorkflowOutputValidationMessages({
      ...fileOutput,
      destination: {
        ...fileOutput.destination,
        options: {
          ...(fileOutput.destination.options ?? {}),
          deliveryMode: "workspace-file",
          destinationPath: "",
        },
      },
      configuration: {
        ...(fileOutput.configuration ?? {}),
        deliveryMode: "workspace-file",
        destinationPath: "",
      },
    })).toContain("File Export workspace-file delivery requires a destination path.");

    const webViewerOutput = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.webViewer,
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(webViewerOutput)).toContain("Web Viewer output requires a viewer title.");
    expect(getWorkflowOutputValidationMessages({
      ...webViewerOutput,
      format: "pdf",
    })).toContain("Web viewer output format 'pdf' is not supported.");

    const systemOutput = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(systemOutput)).toContain(
      "Database/System Record output requires an entity name.",
    );
    expect(getWorkflowOutputValidationMessages(systemOutput)).not.toContain(
      "Database/System Record output requires a valid write mode.",
    );

    const configuredSystem = setWorkflowOutputRecordEntityName(
      { ...createEmptyWorkflowDraft(), outputs: [systemOutput] },
      systemOutput.id,
      "customer.record",
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(configuredSystem)).toEqual([]);

    const chatOutput = addWorkflowOutput(
      createEmptyWorkflowDraft(),
      WorkflowDraftOutputDestinationTypes.promptResponseChat,
    ).draft.outputs[0]!;
    expect(getWorkflowOutputValidationMessages(chatOutput)).toContain("Prompt Response Chat output requires a chat title.");
    expect(getWorkflowOutputValidationMessages(chatOutput)).toContain("Prompt Response Chat output requires a prompt input id link.");
    expect(getWorkflowOutputValidationMessages(chatOutput)).toContain("Prompt Response Chat output requires an initial response field.");
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
    const chatDefinition = workflowOutputTypeDefinitions.find(
      (entry) => entry.destinationType === WorkflowDraftOutputDestinationTypes.promptResponseChat,
    );
    if (!fileDefinition || !systemDefinition || !chatDefinition) {
      throw new Error("Expected workflow output type definitions to be available.");
    }

    const added = addWorkflowOutputs(createEmptyWorkflowDraft(), [
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.systemEntry,
      WorkflowDraftOutputDestinationTypes.promptResponseChat,
    ]);
    const fileOutputId = added.draft.outputs[0]?.id as string;
    const systemOutputId = added.draft.outputs[1]?.id as string;
    const chatOutputId = added.draft.outputs[2]?.id as string;
    const formatField = fileDefinition.configurationFields.find((field) => field.key === "format");
    const entityField = systemDefinition.configurationFields.find((field) => field.key === "entityName");
    const promptInputField = chatDefinition.configurationFields.find((field) => field.key === "promptInputId");
    if (!formatField || !entityField || !promptInputField) {
      throw new Error("Expected output config fields to be available.");
    }

    let draft = setWorkflowOutputFieldValue(added.draft, fileOutputId, formatField, "jsonl").draft;
    draft = setWorkflowOutputFieldValue(draft, systemOutputId, entityField, "customer-record").draft;
    draft = setWorkflowOutputFieldValue(draft, chatOutputId, promptInputField, "input-user-prompt").draft;

    expect(draft.outputs[0]?.format).toBe("jsonl");
    expect(draft.outputs[1]?.destination.options).toEqual(expect.objectContaining({
      entityName: "customer-record",
    }));
    expect(draft.outputs[2]?.destination.options).toEqual(expect.objectContaining({
      promptInputId: "input-user-prompt",
    }));
  });

  it("builds output summaries from canonical draft state and reflects add/edit/remove/reorder changes", () => {
    const added = addWorkflowOutputs(createEmptyWorkflowDraft(), [
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ]).draft;

    const webViewerId = added.outputs[1]?.id as string;
    const systemId = added.outputs[2]?.id as string;
    let next = setWorkflowOutputViewerTitle(added, webViewerId, "Results Panel").draft;
    next = setWorkflowOutputRecordEntityName(next, systemId, "customer.record").draft;

    const beforeReorder = listWorkflowOutputSummaries(next);
    expect(beforeReorder).toHaveLength(3);
    expect(beforeReorder[1]?.displayLabel).toBe("Results Panel");
    expect(beforeReorder[1]?.typeLabel).toBe("Web viewer");
    expect(beforeReorder[2]?.typeLabel).toBe("System record");
    expect(beforeReorder[2]?.detailLines.join(" ")).toContain("Record entity: customer.record");

    const reordered = moveWorkflowOutputUp(next, systemId).draft;
    const reorderedSummaries = listWorkflowOutputSummaries(reordered);
    expect(reorderedSummaries.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(reorderedSummaries[1]?.typeLabel).toBe("System record");

    const removed = removeWorkflowOutput(reordered, webViewerId).draft;
    const removedSummaries = listWorkflowOutputSummaries(removed);
    expect(removedSummaries).toHaveLength(2);
    expect(removedSummaries.some((entry) => entry.displayLabel === "Results Panel")).toBeFalse();
  });

  it("surfaces unknown persisted output types without silently coercing to a default type", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      outputs: [
        {
          id: "output-stale",
          type: "workflow-output",
          order: 1,
          outputType: "document",
          format: "json",
          destination: {
            type: "stale-output-type",
            target: "stale",
          },
        },
      ],
    };

    const summaries = listWorkflowOutputSummaries(draft);
    expect(summaries[0]?.typeLabel).toBe("Unknown output (stale-output-type)");
    expect(getWorkflowOutputValidationMessages(draft.outputs[0] as any)).toContain(
      "Workflow output type 'stale-output-type' is not registered.",
    );
  });
});
