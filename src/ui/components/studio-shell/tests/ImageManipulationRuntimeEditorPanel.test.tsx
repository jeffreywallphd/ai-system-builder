import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";
import ImageManipulationRuntimeEditorPanel, {
  buildImageRunLaunchPrecheckState,
  formatAssetFileSize,
  groupRecentImageAssetsByContinuityWindow,
  resolveLinkedRunForSelectedOutput,
  resolveSelectionConfirmationMessage,
} from "../ImageManipulationRuntimeEditorPanel";

describe("ImageManipulationRuntimeEditorPanel", () => {
  it("renders a bounded fallback message when no image manipulation draft is active", () => {
    const html = renderToStaticMarkup(
      <ImageManipulationRuntimeEditorPanel
        context={{
          studioId: "system-studio",
          snapshot: undefined,
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {},
        }}
      />,
    );

    expect(html).toContain("runtime page is unavailable");
  });

  it("renders the editor layout with preview and gallery regions for template drafts", () => {
    const html = renderToStaticMarkup(
      <ImageManipulationRuntimeEditorPanel
        context={{
          studioId: "system-studio",
          snapshot: {
            studioId: "system-studio",
            studioName: "System Studio",
            activeSessionId: "session-1",
            sessionStatus: "active",
            draft: {
              draftId: "draft-1",
              assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
              content: "{}",
              revision: 1,
              lifecycleStatus: "draft",
              metadata: {
                title: "Reference image system",
                tags: [],
              },
              dependencies: [],
              publishedVersionIds: [],
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
            },
            versions: [],
            validationIssues: [],
          },
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {},
        } as never}
      />,
    );

    expect(html).toContain("Image preview");
    expect(html).toContain("Image browser");
    expect(html).toContain("Selected photos");
    expect(html).toContain("Create image");
    expect(html).toContain("Status: Ready");
    expect(html).toContain("Settings ready");
    expect(html).toContain("Launch precheck: setup");
    expect(html).toContain("Launch precheck: execution environment");
    expect(html).toContain("Refresh precheck");
    expect(html).toContain("Choose a source photo first");
    expect(html).toContain("Run progress");
    expect(html).toContain("Progress details will appear after execution starts.");
    expect(html).toContain("Result review");
    expect(html).toContain("Before and after");
    expect(html).toContain("Use result as source");
    expect(html).toContain("Use result as face reference");
    expect(html).toContain("Rerun with changes");
    expect(html).toContain("No result selected");
    expect(html).toContain("Advanced details");
    expect(html).toContain("Results (0)");
    expect(html).toContain("Source (0)");
    expect(html).toContain("Face reference (0)");
    expect(html).toContain("disabled=\"\"");
  });

  it("groups recent assets into continuity windows for rediscovery", () => {
    const grouped = groupRecentImageAssetsByContinuityWindow([
      {
        assetId: "asset:image:today",
        originalFilename: "today.png",
        mediaType: "image/png",
        sizeBytes: 100,
        lifecycleStatus: "available",
        createdAt: "2026-04-08T12:00:00.000Z",
        updatedAt: "2026-04-08T12:00:00.000Z",
      },
      {
        assetId: "asset:image:week",
        originalFilename: "week.png",
        mediaType: "image/png",
        sizeBytes: 100,
        lifecycleStatus: "available",
        createdAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:00:00.000Z",
      },
      {
        assetId: "asset:image:older",
        originalFilename: "older.png",
        mediaType: "image/png",
        sizeBytes: 100,
        lifecycleStatus: "available",
        createdAt: "2026-03-20T12:00:00.000Z",
        updatedAt: "2026-03-20T12:00:00.000Z",
      },
    ], new Date("2026-04-08T15:00:00.000Z"));

    expect(grouped.map((entry) => entry.key)).toEqual(["today", "week", "older"]);
    expect(grouped[0]?.assets[0]?.assetId).toBe("asset:image:today");
    expect(grouped[1]?.assets[0]?.assetId).toBe("asset:image:week");
    expect(grouped[2]?.assets[0]?.assetId).toBe("asset:image:older");
  });

  it("formats image library file sizes for non-technical display", () => {
    expect(formatAssetFileSize(512)).toBe("512 B");
    expect(formatAssetFileSize(3072)).toBe("3.0 KB");
    expect(formatAssetFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("builds selection confirmation copy from selected source/reference asset metadata", () => {
    expect(resolveSelectionConfirmationMessage({
      selectedSourceItem: {
        sourceImage: {
          assetId: "asset:image:source-1",
        },
      } as never,
      selectedReferenceItem: undefined,
    })).toBe("Source photo selected and ready.");

    expect(resolveSelectionConfirmationMessage({
      selectedSourceItem: {
        sourceImage: {
          assetId: "asset:image:source-1",
        },
      } as never,
      selectedReferenceItem: {
        sourceImage: {
          assetId: "asset:image:reference-1",
        },
      } as never,
    })).toBe("Source and face reference photos are selected.");
  });

  it("builds launch precheck findings that separate setup blockers from backend advisories", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Soft studio relight",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "degraded",
        readyForExecution: true,
        message: "One worker is currently unavailable.",
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
        nodeAvailability: Object.freeze({
          state: "constrained",
          checkedAt: "2026-04-08T18:00:00.000Z",
          candidateNodeCount: 2,
          eligibleNodeCount: 1,
          unavailableNodeCount: 1,
          incompatibleNodeCount: 0,
          topBlockingReasonCodes: Object.freeze([]),
          topTransientAvailabilityReasonCodes: Object.freeze(["node-offline"]),
        }),
        issues: Object.freeze([Object.freeze({
          code: "node-capacity-low",
          severity: "warning",
          message: "Capacity is constrained.",
        })]),
      }),
    });

    expect(precheck.launchReady).toBeTrue();
    expect(precheck.setupBlockingIssues).toHaveLength(0);
    expect(precheck.backendBlockingIssues).toHaveLength(0);
    expect(precheck.backendAdvisories.length).toBeGreaterThan(0);
  });

  it("blocks launch precheck when setup or backend readiness is unresolved", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: undefined,
      selectedSourceAssetId: undefined,
      selectedSourceDatasetInstanceId: undefined,
      prompt: "",
      validationIssues: Object.freeze([{
        scope: "field",
        code: "prompt-required",
        path: "prompts.positivePrompt",
        message: "Prompt is required.",
      }]),
      executionReadinessError: "Could not check execution environment availability.",
    });

    expect(precheck.launchReady).toBeFalse();
    expect(precheck.setupBlockingIssues.length).toBeGreaterThan(0);
    expect(precheck.backendBlockingIssues.length).toBeGreaterThan(0);
  });

  it("links the selected output to run history using workflow run ids", () => {
    const linked = resolveLinkedRunForSelectedOutput({
      selectedOutputItem: {
        workflow: {
          workflowRunId: "run:output:1",
        },
      } as never,
      runHistory: Object.freeze([{
        runId: "run:output:1",
        status: "completed",
      }]) as never,
    });

    expect(linked?.runId).toBe("run:output:1");
    expect(linked?.status).toBe("completed");
  });

  it("falls back to the active run id when result workflow linkage is absent", () => {
    const linked = resolveLinkedRunForSelectedOutput({
      selectedOutputItem: undefined,
      activeRunId: "run:active:1",
      runHistory: Object.freeze([{
        runId: "run:active:1",
        workflowExecutionId: "run:active:1",
        status: "running",
      }]) as never,
    });

    expect(linked?.runId).toBe("run:active:1");
    expect(linked?.status).toBe("running");
  });
});
