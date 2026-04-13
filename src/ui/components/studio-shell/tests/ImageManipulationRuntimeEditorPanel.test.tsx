import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";
import ImageManipulationRuntimeEditorPanel, {
  buildImageRunFailureRecoveryGuidance,
  buildImageRunLaunchPrecheckState,
  ExecutionReadinessLifecycleActions,
  formatAssetFileSize,
  groupRecentImageAssetsByContinuityWindow,
  ImageRunFailureRecoveryActionIds,
  resolveNextGalleryPreviewRoleByKey,
  resolveExecutionReadinessLifecycleAction,
  resolveImageRunFailureRecoveryActionPlan,
  resolveLinkedRunForSelectedOutput,
  resolveCollectionLoadingMessage,
  resolveGalleryLoadingMessage,
  resolvePreviewLoadingMessage,
  buildResultLineageInspectorModel,
  resolveResultLineageCoverageChips,
  resolveResultLineageSummaryMessage,
  resolveReusableRunOutputForRecovery,
  resolveRefreshNeededState,
  resolveResultReviewNotice,
  resolveRunTransitionMessage,
  resolveRunHistorySummary,
  resolveRunOutputRecordId,
  resolveRunParameterSnapshot,
  resolveSelectionConfirmationMessage,
  isPersistedReferenceUploadReady,
  resolveWorkspaceIdFromSession,
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
    expect(html).toContain("Image manipulation studio");
    expect(html).toContain("Selected photos");
    expect(html).toContain("Create image");
    expect(html).toContain("Status: Ready");
    expect(html).toContain("Settings ready");
    expect(html).toContain("Launch precheck: setup");
    expect(html).toContain("Launch precheck: execution environment");
    expect(html).toContain("Execution readiness has not been checked yet.");
    expect(html).toContain("Refresh readiness before launching.");
    expect(html).toContain("Fix setup issues before starting");
    expect(html).toContain("Refresh precheck");
    expect(html).toContain("Choose a source photo first");
    expect(html).toContain("Run progress");
    expect(html).toContain("Progress details will appear after execution starts.");
    expect(html).toContain("Result review");
    expect(html).toContain("Run history");
    expect(html).toContain("No run history yet");
    expect(html).toContain("Before and after");
    expect(html).toContain("Use result as source");
    expect(html).toContain("Use result as face reference");
    expect(html).toContain("Rerun with changes");
    expect(html).toContain("No result selected");
    expect(html).toContain("Advanced details");
    expect(html).toContain("Result details");
    expect(html).toContain("Advanced provenance");
    expect(html).toContain("Results (0)");
    expect(html).toContain("Source (0)");
    expect(html).toContain("Face reference (0)");
    expect(html).toContain("role=\"tabpanel\"");
    expect(html).toContain("role=\"progressbar\"");
    expect(html).toContain("Preparation and run controls");
    expect(html).toContain("Preview, review, and history");
    expect(html).toContain("disabled=\"\"");
  });

  it("resolves keyboard navigation targets for image-browser tabs", () => {
    expect(resolveNextGalleryPreviewRoleByKey({
      activeRole: "output",
      key: "ArrowRight",
    })).toBe("source");
    expect(resolveNextGalleryPreviewRoleByKey({
      activeRole: "output",
      key: "ArrowLeft",
    })).toBe("reference");
    expect(resolveNextGalleryPreviewRoleByKey({
      activeRole: "reference",
      key: "Home",
    })).toBe("output");
    expect(resolveNextGalleryPreviewRoleByKey({
      activeRole: "source",
      key: "End",
    })).toBe("reference");
    expect(resolveNextGalleryPreviewRoleByKey({
      activeRole: "source",
      key: "Enter",
    })).toBeUndefined();
  });

  it("builds contextual loading and transition messages for operational feedback", () => {
    expect(resolveCollectionLoadingMessage({
      source: true,
      output: false,
      reference: true,
    })).toContain("source photos and face reference photos");
    expect(resolvePreviewLoadingMessage("output")).toContain("result record");
    expect(resolveGalleryLoadingMessage("source")).toContain("input image dataset");
    expect(resolveRunTransitionMessage({
      isFetchingRunResult: true,
      isPersistingRunResult: false,
      isRefreshingAfterRun: false,
    })).toContain("Retrieving");
  });

  it("routes readiness checks through runtime lifecycle activation before querying backend readiness", () => {
    expect(resolveExecutionReadinessLifecycleAction({
      sessionToken: undefined,
      runtimeLifecycleReady: false,
      hasRuntimeLifecycleBridge: true,
      executionReadinessFeatureAvailable: true,
    })).toBe(ExecutionReadinessLifecycleActions.blockUnauthorized);

    expect(resolveExecutionReadinessLifecycleAction({
      sessionToken: "session-token",
      runtimeLifecycleReady: false,
      hasRuntimeLifecycleBridge: true,
      executionReadinessFeatureAvailable: true,
    })).toBe(ExecutionReadinessLifecycleActions.activateRuntime);

    expect(resolveExecutionReadinessLifecycleAction({
      sessionToken: "session-token",
      runtimeLifecycleReady: true,
      hasRuntimeLifecycleBridge: true,
      executionReadinessFeatureAvailable: true,
    })).toBe(ExecutionReadinessLifecycleActions.queryReadiness);

    expect(resolveExecutionReadinessLifecycleAction({
      sessionToken: "session-token",
      runtimeLifecycleReady: true,
      hasRuntimeLifecycleBridge: false,
      executionReadinessFeatureAvailable: false,
    })).toBe(ExecutionReadinessLifecycleActions.skipFeatureUnavailable);
  });

  it("flags refresh-needed state only when authoritative surfaces are no longer actively loading", () => {
    expect(resolveRefreshNeededState({
      isLoadingCollections: true,
      isLoadingRunHistory: false,
      isCheckingExecutionReadiness: false,
      hasCollectionLoadError: true,
    })).toBeUndefined();

    const state = resolveRefreshNeededState({
      isLoadingCollections: false,
      isLoadingRunHistory: false,
      isCheckingExecutionReadiness: false,
      hasCollectionLoadError: true,
    });
    expect(state?.title).toBe("Refresh recommended");
    expect(state?.message).toContain("partially unavailable");
  });

  it("surfaces preview-pending and partial-result review notices from authoritative lifecycle state", () => {
    const pending = resolveResultReviewNotice({
      runLifecycleState: "completed",
      selectedOutputRecordId: undefined,
      outputItemCount: 0,
      isLoadingOutputs: false,
      isRefreshingReview: false,
    });
    expect(pending?.title).toBe("Preview pending");

    const partial = resolveResultReviewNotice({
      runLifecycleState: "completed",
      selectedOutputRecordId: undefined,
      outputItemCount: 0,
      outputLoadError: "Unavailable",
      isLoadingOutputs: false,
      isRefreshingReview: false,
    });
    expect(partial?.title).toBe("Results partially available");
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

  it("treats image upload success as persisted-only when stored file evidence exists", () => {
    expect(isPersistedReferenceUploadReady({
      storedFilePath: "/tmp/reference-image-uploads/input.png",
      persistence: {
        storedFilePathProduced: true,
      },
    })).toBeTrue();

    expect(isPersistedReferenceUploadReady({
      storedFilePath: undefined,
      persistence: {
        storedFilePathProduced: false,
      },
    })).toBeFalse();
  });

  it("resolves a workspace id from fallback session workspace context fields", () => {
    expect(resolveWorkspaceIdFromSession(undefined)).toBeUndefined();
    expect(resolveWorkspaceIdFromSession({
      userIdentityId: "user-1",
      username: "alice",
      providerId: "provider:local-password",
      sessionId: "session-1",
      sessionToken: "token-1",
      sessionTokenType: "Bearer",
      sessionIssuedAt: "2026-04-12T00:00:00.000Z",
      sessionExpiresAt: "2026-04-12T23:59:59.000Z",
      workspaceContext: {
        requestedWorkspaceId: "workspace:requested",
        resolvedWorkspaceId: undefined,
        workspaces: Object.freeze([]),
      },
      initialCapabilityState: {
        workspaceId: "workspace:capability",
        effectiveRoles: Object.freeze([]),
        canAdministrate: false,
        isWorkspaceOwner: false,
      },
    })).toBe("workspace:requested");
    expect(resolveWorkspaceIdFromSession({
      userIdentityId: "user-1",
      username: "alice",
      providerId: "provider:local-password",
      sessionId: "session-1",
      sessionToken: "token-1",
      sessionTokenType: "Bearer",
      sessionIssuedAt: "2026-04-12T00:00:00.000Z",
      sessionExpiresAt: "2026-04-12T23:59:59.000Z",
      workspaceContext: {
        requestedWorkspaceId: undefined,
        resolvedWorkspaceId: undefined,
        workspaces: Object.freeze([
          {
            workspaceId: "workspace:first",
            slug: "workspace-first",
            displayName: "Workspace First",
            status: "active",
            visibility: "private",
            membershipStatus: "active",
            effectiveRoles: Object.freeze(["member"]),
            canAdministrate: false,
            isWorkspaceOwner: false,
          },
        ]),
      },
      initialCapabilityState: undefined,
    })).toBe("workspace:first");
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
    expect(precheck.backendOperationalStatus.category).toBe("degraded");
    expect(precheck.backendOperationalStatus.temporary).toBeTrue();
  });

  it("classifies no-eligible-node readiness as operational and temporary", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "unavailable",
        readyForExecution: false,
        message: "No eligible node satisfies required capabilities.",
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
          eligibleNodeCount: 0,
          unavailableNodeCount: 1,
          incompatibleNodeCount: 1,
          topBlockingReasonCodes: Object.freeze(["execution-node-no-eligible-match"]),
          topTransientAvailabilityReasonCodes: Object.freeze(["node-offline"]),
          reasonCode: "execution-node-no-eligible-match",
        }),
        issues: Object.freeze([{
          code: "execution-node-no-eligible-match",
          severity: "error",
          message: "No eligible node.",
        }]),
      }),
    });

    expect(precheck.launchReady).toBeFalse();
    expect(precheck.backendOperationalStatus.category).toBe("no-eligible-node");
    expect(precheck.backendOperationalStatus.temporary).toBeTrue();
    expect(precheck.backendOperationalStatus.summary).toContain("no eligible execution node");
  });

  it("classifies backend compatibility readiness failures separately from outage messaging", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "unavailable",
        readyForExecution: false,
        message: "No compatible translation contract is configured.",
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["2.0.0"]),
        }),
        nodeAvailability: Object.freeze({
          state: "unknown",
          checkedAt: "2026-04-08T18:00:00.000Z",
          candidateNodeCount: 0,
          eligibleNodeCount: 0,
          unavailableNodeCount: 0,
          incompatibleNodeCount: 0,
          topBlockingReasonCodes: Object.freeze([]),
          topTransientAvailabilityReasonCodes: Object.freeze([]),
          reasonCode: "node-availability-evaluation-skipped-backend-blocking",
        }),
        issues: Object.freeze([{
          code: "translation-contract-version-unsupported",
          severity: "error",
          message: "Translation contract version is unsupported.",
        }]),
      }),
    });

    expect(precheck.launchReady).toBeFalse();
    expect(precheck.backendOperationalStatus.category).toBe("no-compatible-backend");
    expect(precheck.backendOperationalStatus.summary).toContain("No compatible execution backend");

    const guidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: { state: "idle" },
      flowIssues: Object.freeze([]),
      launchPrecheck: precheck,
    });
    expect(guidance?.kind).toBe("operator-action");
    expect(guidance?.title).toContain("No compatible execution backend");
  });

  it("classifies disabled-node policy blockers distinctly from generic no-eligible messaging", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "degraded",
        readyForExecution: false,
        message: "Node policy currently blocks execution.",
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
          candidateNodeCount: 1,
          eligibleNodeCount: 0,
          unavailableNodeCount: 0,
          incompatibleNodeCount: 1,
          topBlockingReasonCodes: Object.freeze(["node-disabled-by-policy", "execution-node-no-eligible-match"]),
          topTransientAvailabilityReasonCodes: Object.freeze([]),
          reasonCode: "execution-node-no-eligible-match",
        }),
        issues: Object.freeze([{
          code: "execution-node-no-eligible-match",
          severity: "error",
          message: "No eligible node.",
        }]),
      }),
    });

    expect(precheck.launchReady).toBeFalse();
    expect(precheck.backendOperationalStatus.category).toBe("node-disabled");
    expect(precheck.backendOperationalStatus.summary).toContain("disabled by policy");

    const guidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: { state: "idle" },
      flowIssues: Object.freeze([]),
      launchPrecheck: precheck,
    });
    expect(guidance?.kind).toBe("operator-action");
    expect(guidance?.title).toContain("Execution node access is disabled");
  });

  it("builds user-fixable recovery guidance when launch is blocked by setup issues", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: undefined,
      selectedSourceAssetId: undefined,
      selectedSourceDatasetInstanceId: undefined,
      prompt: "",
      validationIssues: Object.freeze([]),
    });

    const guidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: {
        state: "idle",
      },
      flowIssues: Object.freeze([]),
      launchPrecheck: precheck,
    });

    expect(guidance?.mode).toBe("launch-blocked");
    expect(guidance?.kind).toBe("user-fixable");
    expect(guidance?.canRetryNow).toBeFalse();
  });

  it("builds retry-later guidance for retryable failed runs", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "ready",
        readyForExecution: true,
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
        issues: Object.freeze([]),
      }),
    });

    const guidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: {
        state: "failed",
      },
      flowIssues: Object.freeze([Object.freeze({
        stepId: "persistence",
        code: "output-materialization-failed",
        userMessage: "Something went wrong while saving this image.",
        retryable: true,
      })]),
      launchPrecheck: precheck,
    });

    expect(guidance?.mode).toBe("run-failed");
    expect(guidance?.kind).toBe("retry-later");
    expect(guidance?.canRetryNow).toBeTrue();
  });

  it("does not allow retry-now for user-fixable failure codes even when retryable is flagged", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "ready",
        readyForExecution: true,
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
        issues: Object.freeze([]),
      }),
    });

    const guidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: {
        state: "failed",
      },
      flowIssues: Object.freeze([Object.freeze({
        stepId: "execution",
        code: "im.dispatch.validation.invalid-request-data",
        userMessage: "Fix settings before retrying.",
        retryable: true,
      })]),
      launchPrecheck: precheck,
    });

    expect(guidance?.kind).toBe("user-fixable");
    expect(guidance?.canRetryNow).toBeFalse();
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
    expect(precheck.backendOperationalStatus.category).toBe("unknown");
  });

  it("uses operational outage/no-node context in launch-blocked recovery guidance", () => {
    const precheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "unavailable",
        readyForExecution: false,
        message: "No eligible node satisfies required capabilities.",
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
          eligibleNodeCount: 0,
          unavailableNodeCount: 1,
          incompatibleNodeCount: 1,
          topBlockingReasonCodes: Object.freeze(["execution-node-no-eligible-match"]),
          topTransientAvailabilityReasonCodes: Object.freeze(["node-offline"]),
          reasonCode: "execution-node-no-eligible-match",
        }),
        issues: Object.freeze([{
          code: "execution-node-no-eligible-match",
          severity: "error",
          message: "No eligible node.",
        }]),
      }),
    });

    const guidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: { state: "idle" },
      flowIssues: Object.freeze([]),
      launchPrecheck: precheck,
    });

    expect(guidance?.mode).toBe("launch-blocked");
    expect(guidance?.title).toContain("No eligible execution node");
    expect(guidance?.recommendedActions[0]).toContain("Wait for node availability");
  });

  it("derives safe recovery action plans for blocked launches and retryable failures", () => {
    const blockedPrecheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: undefined,
      selectedSourceAssetId: undefined,
      selectedSourceDatasetInstanceId: undefined,
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
    });
    const blockedGuidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: {
        state: "idle",
      },
      flowIssues: Object.freeze([]),
      launchPrecheck: blockedPrecheck,
    });
    const blockedPlan = resolveImageRunFailureRecoveryActionPlan({
      guidance: blockedGuidance,
      launchPrecheck: blockedPrecheck,
      latestRecentSystemId: "system:latest:1",
      runHistory: Object.freeze([]),
    });

    expect(blockedPlan.actions.map((entry) => entry.actionId)).toContain(ImageRunFailureRecoveryActionIds.reselectSourceImage);
    expect(blockedPlan.actions.map((entry) => entry.actionId)).toContain(ImageRunFailureRecoveryActionIds.reopenLatestSetup);
    expect(blockedPlan.actions.map((entry) => entry.actionId)).not.toContain(ImageRunFailureRecoveryActionIds.retryLaunch);

    const retryablePrecheck = buildImageRunLaunchPrecheckState({
      selectedSourceRecordId: "record:source:1",
      selectedSourceAssetId: "asset:source:1",
      selectedSourceDatasetInstanceId: "dataset:source:1",
      prompt: "Relight scene",
      validationIssues: Object.freeze([]),
      executionReadiness: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T18:00:00.000Z",
        readiness: "ready",
        readyForExecution: true,
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
        issues: Object.freeze([]),
      }),
    });
    const retryableGuidance = buildImageRunFailureRecoveryGuidance({
      runLifecycle: {
        state: "failed",
      },
      flowIssues: Object.freeze([Object.freeze({
        stepId: "persistence",
        code: "im.result.operational.output-collection-partial-anomaly",
        userMessage: "Some outputs were saved.",
        retryable: true,
      })]),
      launchPrecheck: retryablePrecheck,
    });
    const retryablePlan = resolveImageRunFailureRecoveryActionPlan({
      guidance: retryableGuidance,
      launchPrecheck: retryablePrecheck,
      runHistory: Object.freeze([{
        runId: "run:completed:1",
        status: "completed",
        outputs: {
          datasetInstance: {
            persistedRecordIds: ["record:output:1"],
          },
          images: [],
        },
      }]) as never,
    });

    expect(retryablePlan.actions.map((entry) => entry.actionId)).toContain(ImageRunFailureRecoveryActionIds.retryLaunch);
    expect(retryablePlan.actions.map((entry) => entry.actionId)).toContain(ImageRunFailureRecoveryActionIds.reusePriorResult);
    expect(retryablePlan.reusablePriorRunOutput?.recordId).toBe("record:output:1");
  });

  it("prefers completed or partial run outputs when selecting reusable recovery context", () => {
    const reusable = resolveReusableRunOutputForRecovery(Object.freeze([
      {
        runId: "run:failed:1",
        status: "failed",
        outputs: {
          images: [{
            recordId: "record:failed:1",
          }],
        },
      },
      {
        runId: "run:completed:1",
        status: "completed",
        outputs: {
          datasetInstance: {
            persistedRecordIds: ["record:completed:1"],
          },
          images: [],
        },
      },
    ]) as never);

    expect(reusable?.runId).toBe("run:completed:1");
    expect(reusable?.recordId).toBe("record:completed:1");
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

  it("resolves authoritative run output record ids for continuation", () => {
    expect(resolveRunOutputRecordId({
      outputs: {
        datasetInstance: {
          persistedRecordIds: ["record:output:1"],
        },
        images: [],
      },
    } as never)).toBe("record:output:1");

    expect(resolveRunOutputRecordId({
      outputs: {
        images: [{
          recordId: "record:output:2",
        }],
      },
    } as never)).toBe("record:output:2");
  });

  it("prefers explicit edit instruction copy when summarizing history entries", () => {
    expect(resolveRunHistorySummary({
      inputs: {
        parameterSummary: {
          editInstruction: "Keep the pose and brighten the scene.",
        },
      },
    } as never)).toBe("Keep the pose and brighten the scene.");
  });

  it("restores preset and config snapshots from run parameter summaries", () => {
    const snapshot = resolveRunParameterSnapshot({
      fallbackPresetId: "portrait-clean-v1",
      run: {
        inputs: {
          parameterSummary: {
            presetId: "portrait-clean-v1",
            imageConfig: {
              prompts: {
                positivePrompt: "Cinematic portrait relight",
              },
            },
          },
        },
      } as never,
    });

    expect(snapshot?.presetId).toBe("portrait-clean-v1");
    expect(snapshot?.config.prompts.positivePrompt).toBe("Cinematic portrait relight");
  });

  it("builds layered result-lineage inspector summaries from authoritative detail and lineage payloads", () => {
    const model = buildResultLineageInspectorModel({
      selectedOutputItem: {
        image: {
          recordId: "result-1",
        },
        dataset: {
          systemId: "system-1",
        },
        workflow: {
          workflowRunId: "run-1",
          workflowAssetId: "workflow-1",
          generationRole: "primary",
        },
        sourceImage: {
          stableId: "asset:input:1",
        },
        imageMetadataSummary: {
          metadata: {
            lineageInputAssetCount: 1,
          },
        },
        generationParametersSummary: {
          resultStatus: "preview-ready",
        },
      } as never,
      detail: {
        result: {
          resultAssetId: "result-1",
          runId: "run-1",
          systemId: "system-1",
          workflowId: "workflow-1",
          outputSlot: "primary",
          status: "preview-ready",
          lineage: {
            hasWorkflowTemplateVersion: true,
            hasSystemSnapshot: true,
            hasParameterSnapshot: true,
            hasSelectedNode: true,
            inputAssetCount: 1,
          },
        },
      } as never,
      lineage: {
        lineage: {
          summary: {
            resultAssetId: "result-1",
            runId: "run-1",
            systemId: "system-1",
            workflowId: "workflow-1",
            outputSlot: "primary",
            inputAssetCount: 1,
            hasWorkflowTemplateVersion: true,
            hasSystemSnapshot: true,
            hasParameterSnapshot: true,
            hasSelectedNode: true,
          },
          upstreamInputs: [{
            assetId: "asset:input:1",
          }],
        },
      } as never,
    });

    expect(model?.resultAssetId).toBe("result-1");
    expect(model?.inputAssetCount).toBe(1);
    expect(resolveResultLineageSummaryMessage(model)).toContain("run run-1");
    expect(resolveResultLineageCoverageChips(model)).toContain("Workflow version captured");
    expect(resolveResultLineageCoverageChips(model)).toContain("Execution node captured");
  });
});
