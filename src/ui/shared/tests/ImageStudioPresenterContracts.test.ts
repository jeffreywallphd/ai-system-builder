import { describe, expect, it } from "bun:test";
import {
  ImageStudioFlowStepIds,
  createInitialImageStudioInteractionState,
  reduceImageStudioInteractionState,
} from "../images/ImageStudioInteractionModel";
import {
  composeImageStudioPresenterViewModel,
  mapImageStudioStepGateToPresenterBlockers,
  selectImageStudioPrimaryAction,
  selectImageStudioSurfaceState,
} from "../images/ImageStudioPresenterContracts";

describe("ImageStudioPresenterContracts", () => {
  it("composes stable UI-facing contracts for the full completed flow", () => {
    let interaction = createInitialImageStudioInteractionState();
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "select-input-image",
      selection: {
        selectionId: "selection:1",
        sourceKind: "dataset-item",
        assetId: "asset:image:1",
        recordId: "record:image:1",
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "select-workflow-system",
      selection: {
        workflowId: "workflow:restyle:v1",
        workflowVersionId: "1.0.0",
        systemId: "system:image:default",
        parameterDefaults: {
          prompt: "cinematic",
        },
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "readiness-resolved",
      readiness: {
        assessedAtIso: "2026-04-08T13:00:00.000Z",
        ready: true,
        issues: [{
          code: "recommendation-1",
          message: "Lower guidance for softer details.",
          severity: "advisory",
        }],
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "run-launch-accepted",
      run: {
        runId: "run:1",
        status: "completed",
        requestedAtIso: "2026-04-08T13:01:00.000Z",
        updatedAtIso: "2026-04-08T13:02:00.000Z",
        workflowId: "workflow:restyle:v1",
        sourceSelectionId: "selection:1",
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "results-synchronized",
      results: {
        datasetInstanceId: "dataset:results:1",
        resolvedAtIso: "2026-04-08T13:02:10.000Z",
        items: [{
          resultId: "result:1",
          recordId: "record:result:1",
          imageReference: "storage://results/1.png",
          previewReference: "storage://results/1-thumb.png",
          runId: "run:1",
        }],
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "select-result",
      resultId: "result:1",
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "mark-result-reusable",
      resultId: "result:1",
    });

    const viewModel = composeImageStudioPresenterViewModel({
      interaction,
      inputOptions: {
        state: "ready",
        data: [{
          selectionId: "selection:1",
          label: "Portrait source",
          sourceLabel: "Library",
          previewUrl: "https://cdn.example.com/source-1.png",
        }],
      },
      workflowOptions: {
        state: "ready",
        data: [{
          workflowId: "workflow:restyle:v1",
          name: "Restyle",
          supportedImageModes: ["single-image"],
          defaultSystemId: "system:image:default",
        }],
      },
      systemOptions: {
        state: "ready",
        data: [{
          systemId: "system:image:default",
          name: "Default image runtime",
          runtimeReady: true,
        }],
      },
      runMonitoring: {
        state: "ready",
        data: {
          runId: "run:1",
          status: "completed",
          percentComplete: 100,
          statusMessage: "Completed.",
          warnings: ["One optional model was skipped."],
        },
      },
      resultPreviews: {
        state: "ready",
        data: [{
          resultId: "result:1",
          title: "Restyle output",
          previewUrl: "https://cdn.example.com/result-1.png",
          mediaType: "image/png",
        }],
      },
      continuation: {
        state: "ready",
        data: {
          continuationSessionId: "session:1",
          summary: "Resume your latest image session.",
        },
      },
    });

    expect(viewModel.title).toBe("Image Studio");
    expect(viewModel.subtitle).toContain("Upload or choose an image");
    expect(viewModel.flow.find((step) => step.stepId === ImageStudioFlowStepIds.reviewResults)?.status).toBe("current");
    expect(viewModel.input.state.kind).toBe("ready");
    expect(viewModel.workflow.state.kind).toBe("ready");
    expect(viewModel.readiness.state.kind).toBe("degraded");
    expect(viewModel.run.state.kind).toBe("ready");
    expect(viewModel.results.state.kind).toBe("ready");
    expect(viewModel.results.cards[0]?.reusable).toBeTrue();
    expect(viewModel.primaryAction.label).toBe("Review results");
    expect(viewModel.advanced.hiddenByDefault).toBeTrue();
    expect(viewModel.advanced.technicalNotes.some((note) => note.startsWith("currentStep="))).toBeTrue();
  });

  it("maps loading, empty, error, and degraded states consistently", () => {
    let interaction = createInitialImageStudioInteractionState();
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "select-input-image",
      selection: {
        selectionId: "selection:missing",
        sourceKind: "asset-version",
        assetId: "asset:image:missing",
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "select-workflow-system",
      selection: {
        workflowId: "workflow:missing",
        systemId: "system:missing",
        parameterDefaults: {},
      },
    });
    interaction = reduceImageStudioInteractionState(interaction, {
      type: "run-launch-accepted",
      run: {
        runId: "run:failed",
        status: "failed",
        requestedAtIso: "2026-04-08T14:00:00.000Z",
        updatedAtIso: "2026-04-08T14:01:00.000Z",
        workflowId: "workflow:missing",
        sourceSelectionId: "selection:missing",
      },
    });

    const viewModel = composeImageStudioPresenterViewModel({
      interaction,
      inputOptions: {
        state: "loading",
      },
      workflowOptions: {
        state: "error",
        errorMessage: "Workflow service unavailable",
      },
      systemOptions: {
        state: "ready",
        data: [],
      },
      runMonitoring: {
        state: "error",
        errorMessage: "Realtime status unavailable",
      },
      resultPreviews: {
        state: "error",
        errorMessage: "Preview service timeout",
      },
      continuation: {
        state: "idle",
      },
    });

    expect(selectImageStudioSurfaceState(viewModel, "input").kind).toBe("loading");
    expect(selectImageStudioSurfaceState(viewModel, "workflow").kind).toBe("error");
    expect(selectImageStudioSurfaceState(viewModel, "run").kind).toBe("degraded");
    expect(selectImageStudioSurfaceState(viewModel, "results").kind).toBe("degraded");
    expect(selectImageStudioSurfaceState(viewModel, "continuation").kind).toBe("empty");
    expect(selectImageStudioSurfaceState(viewModel, "run").resilience?.state).toBe("temporarily-unavailable");
    expect(selectImageStudioSurfaceState(viewModel, "results").resilience?.state).toBe("pending-recovery");
    expect(selectImageStudioSurfaceState(viewModel, "run").recovery?.recoveryAction.kind).toBe("retry-automatic");
    expect(selectImageStudioSurfaceState(viewModel, "results").recovery?.recoveryAction.kind).toBe("backend-recovery-pending");

    const action = selectImageStudioPrimaryAction(viewModel);
    expect(action.actionId).toBe("review-progress");
    expect(action.reason).toBeUndefined();
  });

  it("maps flow gate blockers to user-facing messages", () => {
    const interaction = createInitialImageStudioInteractionState();
    const gate = interaction.derived.stepGates.find((entry) => entry.stepId === ImageStudioFlowStepIds.selectImage);

    expect(gate).toBeDefined();
    const blockers = mapImageStudioStepGateToPresenterBlockers(gate!);
    expect(blockers).toContain("Choose an image to continue.");
  });
});
