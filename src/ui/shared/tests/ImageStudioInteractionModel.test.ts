import { describe, expect, it } from "bun:test";
import {
  ImageStudioFlowStepIds,
  createInitialImageStudioInteractionState,
  reduceImageStudioInteractionState,
} from "../images/ImageStudioInteractionModel";

describe("ImageStudioInteractionModel", () => {
  it("projects canonical flow progression from image selection through result review", () => {
    let state = createInitialImageStudioInteractionState();
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.selectImage);

    state = reduceImageStudioInteractionState(state, {
      type: "select-input-image",
      selection: {
        selectionId: "selection:input:1",
        sourceKind: "dataset-item",
        assetId: "asset:dataset:input",
        versionId: "asset:dataset:input:v1",
        datasetInstanceId: "dataset-instance:input",
        recordId: "record:input:1",
      },
    });
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.selectWorkflow);

    state = reduceImageStudioInteractionState(state, {
      type: "select-workflow-system",
      selection: {
        workflowId: "image-template:image-to-image-restyle:v1",
        workflowVersionId: "1.0.0",
        systemId: "system:image:studio",
        systemVersionId: "system:image:studio:v1",
        parameterDefaults: {
          prompt: "cinematic",
          guidance: 7,
        },
      },
    });
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.assessReadiness);

    state = reduceImageStudioInteractionState(state, {
      type: "readiness-resolved",
      readiness: {
        assessedAtIso: "2026-04-08T10:00:00.000Z",
        ready: true,
        issues: [],
      },
    });
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.launchRun);
    expect(state.derived.canLaunchRun).toBeTrue();

    state = reduceImageStudioInteractionState(state, {
      type: "run-launch-accepted",
      run: {
        runId: "run:1",
        status: "running",
        requestedAtIso: "2026-04-08T10:01:00.000Z",
        updatedAtIso: "2026-04-08T10:01:00.000Z",
        workflowId: "image-template:image-to-image-restyle:v1",
        sourceSelectionId: "selection:input:1",
      },
    });
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.monitorRun);
    expect(state.derived.runMonitorState).toBe("active");

    state = reduceImageStudioInteractionState(state, {
      type: "run-status-updated",
      runId: "run:1",
      status: "completed",
      updatedAtIso: "2026-04-08T10:02:00.000Z",
    });
    state = reduceImageStudioInteractionState(state, {
      type: "results-synchronized",
      results: {
        datasetInstanceId: "dataset-instance:results",
        resolvedAtIso: "2026-04-08T10:02:10.000Z",
        items: [{
          resultId: "result:1",
          recordId: "record:result:1",
          imageReference: "storage://outputs/result-1.png",
          previewReference: "storage://outputs/result-1-thumb.png",
          runId: "run:1",
        }],
      },
    });

    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.reviewResults);
    expect(state.derived.canReviewResults).toBeTrue();
  });

  it("invalidates readiness and downstream run/result state when parameter draft changes", () => {
    let state = createInitialImageStudioInteractionState();

    state = reduceImageStudioInteractionState(state, {
      type: "select-input-image",
      selection: {
        selectionId: "selection:input:2",
        sourceKind: "asset-version",
        assetId: "asset:image:input:2",
        versionId: "asset:image:input:2:v1",
      },
    });
    state = reduceImageStudioInteractionState(state, {
      type: "select-workflow-system",
      selection: {
        workflowId: "image-template:enhance-upscale:v1",
        workflowVersionId: "1.0.0",
        systemId: "system:image:studio",
        systemVersionId: "system:image:studio:v1",
        parameterDefaults: {
          scaleFactor: 2,
        },
      },
    });
    state = reduceImageStudioInteractionState(state, {
      type: "readiness-resolved",
      readiness: {
        assessedAtIso: "2026-04-08T11:00:00.000Z",
        ready: true,
        issues: [],
      },
    });
    state = reduceImageStudioInteractionState(state, {
      type: "run-launch-accepted",
      run: {
        runId: "run:2",
        status: "completed",
        requestedAtIso: "2026-04-08T11:01:00.000Z",
        updatedAtIso: "2026-04-08T11:02:00.000Z",
        workflowId: "image-template:enhance-upscale:v1",
        sourceSelectionId: "selection:input:2",
      },
    });
    state = reduceImageStudioInteractionState(state, {
      type: "results-synchronized",
      results: {
        datasetInstanceId: "dataset-instance:results:2",
        resolvedAtIso: "2026-04-08T11:02:10.000Z",
        items: [{
          resultId: "result:2",
          recordId: "record:result:2",
          imageReference: "storage://outputs/result-2.png",
          runId: "run:2",
        }],
      },
    });

    state = reduceImageStudioInteractionState(state, {
      type: "set-parameter-draft",
      values: {
        scaleFactor: 4,
      },
    });

    expect(state.authoritative.readiness).toBeUndefined();
    expect(state.authoritative.activeRun).toBeUndefined();
    expect(state.authoritative.results).toBeUndefined();
    expect(state.transient.parameterDraftDirty).toBeTrue();
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.configureParameters);
    expect(state.derived.canLaunchRun).toBeFalse();
  });

  it("supports continuation and authoritative reopen without introducing local-only truth", () => {
    let state = createInitialImageStudioInteractionState({
      authoritative: {
        inputSelection: {
          selectionId: "selection:input:resume",
          sourceKind: "result-record",
          assetId: "asset:dataset:results",
          datasetInstanceId: "dataset-instance:results",
          recordId: "record:result:10",
        },
        workflowSelection: {
          workflowId: "image-template:mask-guided-edit:v1",
          systemId: "system:image:studio",
          parameterDefaults: {
            strength: 0.5,
          },
        },
        committedParameters: {
          strength: 0.75,
        },
        runHistory: [{
          runId: "run:resume",
          status: "completed",
          requestedAtIso: "2026-04-07T09:00:00.000Z",
          updatedAtIso: "2026-04-07T09:05:00.000Z",
          workflowId: "image-template:mask-guided-edit:v1",
          sourceSelectionId: "selection:input:resume",
          resultDatasetInstanceId: "dataset-instance:results",
        }],
        activeRun: {
          runId: "run:resume",
          status: "completed",
          requestedAtIso: "2026-04-07T09:00:00.000Z",
          updatedAtIso: "2026-04-07T09:05:00.000Z",
          workflowId: "image-template:mask-guided-edit:v1",
          sourceSelectionId: "selection:input:resume",
          resultDatasetInstanceId: "dataset-instance:results",
        },
        results: {
          datasetInstanceId: "dataset-instance:results",
          resolvedAtIso: "2026-04-07T09:05:10.000Z",
          items: [{
            resultId: "result:resume",
            recordId: "record:result:resume",
            imageReference: "storage://outputs/result-resume.png",
            runId: "run:resume",
          }],
        },
      },
    });
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.reviewResults);

    state = reduceImageStudioInteractionState(state, {
      type: "resume-session",
      continuationSessionId: "session:resume:1",
      runId: "run:resume",
    });

    expect(state.authoritative.continuationSessionId).toBe("session:resume:1");
    expect(state.authoritative.activeRun?.runId).toBe("run:resume");
    expect(state.transient.pollingRunStatus).toBeTrue();
    expect(state.derived.currentStepId).toBe(ImageStudioFlowStepIds.reviewResults);
    expect(state.transitions[state.transitions.length - 1]?.actionType).toBe("resume-session");
  });
});
