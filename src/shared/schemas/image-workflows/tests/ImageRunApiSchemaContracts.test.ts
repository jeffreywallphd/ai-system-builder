import { describe, expect, it } from "bun:test";
import {
  ImageRunApiSchemaValidationError,
  parseGetImageRunExecutionReadinessResponseDto,
  parseImageRunSubmissionRequestDto,
  parseListImageRunEventsResponseDto,
  parseListImageRunsResponseDto,
  parseSubmitImageRunResponseDto,
} from "../ImageRunApiSchemaContracts";

describe("ImageRunApiSchemaContracts", () => {
  it("parses image run submission requests with logical asset references", () => {
    const parsed = parseImageRunSubmissionRequestDto({
      contractVersion: "image-run-api/v1",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:1",
      systemId: "system:portrait-restyle",
      source: "ui-manual",
      inputAssets: [{
        bindingId: "input.source",
        assetId: "asset:image:source:1",
      }],
      parameterOverrides: {
        prompt: "cinematic portrait",
      },
    });

    expect(parsed.systemId).toBe("system:portrait-restyle");
    expect(parsed.inputAssets?.[0]?.assetId).toBe("asset:image:source:1");
  });

  it("rejects filesystem paths in submission asset references", () => {
    expect(() => parseImageRunSubmissionRequestDto({
      contractVersion: "image-run-api/v1",
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:1",
      systemId: "system:portrait-restyle",
      inputAssets: [{
        bindingId: "input.source",
        assetId: "C:\\images\\source.png",
      }],
    })).toThrow(ImageRunApiSchemaValidationError);
  });

  it("parses submit-run responses with normalized progress and failure payloads", () => {
    const parsed = parseSubmitImageRunResponseDto({
      contractVersion: "image-run-api/v1",
      run: {
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        workflowId: "wf:image:restyle",
        state: "failed",
        source: "api",
        submittedAt: "2026-04-08T15:00:00.000Z",
        updatedAt: "2026-04-08T15:01:00.000Z",
        progress: {
          state: "running",
          updatedAt: "2026-04-08T15:00:40.000Z",
          percent: 72.5,
        },
        failure: {
          code: "execution-timeout",
          category: "timeout",
          summary: "Execution timed out before completion.",
          retryable: true,
          recovery: {
            retry: {
              retryEligible: true,
              retrySafe: true,
              retryMode: "automatic",
              retryAfterMs: 5000,
            },
            recoveryAction: {
              kind: "retry-automatic",
              userActionRequired: false,
              backendRecoveryPending: false,
              terminalNotRetryable: false,
              summary: "Automatic retry is allowed.",
            },
            escalation: {
              category: "none",
              required: false,
            },
          },
          failedAt: "2026-04-08T15:01:00.000Z",
          partialProgressObserved: true,
          partialOutputCount: 1,
          visibility: "user-safe",
          diagnostics: {
            detailKeys: ["stage", "elapsedMs"],
          },
        },
        submittedByActorId: "user:1",
      },
      mutation: {
        changed: true,
        mutationId: "mutation:run:1",
        occurredAt: "2026-04-08T15:01:00.000Z",
      },
    });

    expect(parsed.run.failure?.category).toBe("timeout");
    expect(parsed.run.failure?.recovery?.retry.retryMode).toBe("automatic");
    expect(parsed.run.progress?.percent).toBe(72.5);
  });

  it("parses list-runs responses with pagination", () => {
    const parsed = parseListImageRunsResponseDto({
      contractVersion: "image-run-api/v1",
      items: [{
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        workflowId: "wf:image:restyle",
        state: "running",
        source: "api",
        submittedAt: "2026-04-08T15:00:00.000Z",
        updatedAt: "2026-04-08T15:00:30.000Z",
      }],
      pagination: {
        limit: 25,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.pagination.returned).toBe(1);
  });

  it("parses execution-readiness responses for image runs", () => {
    const parsed = parseGetImageRunExecutionReadinessResponseDto({
      contractVersion: "image-run-api/v1",
      readiness: {
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T15:02:00.000Z",
        readiness: "degraded",
        readyForExecution: false,
        capabilities: {
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: ["image-to-image"],
          supportedTranslationContractVersions: ["1.0.0"],
        },
        issues: [{
          code: "translation-contract-version-unsupported",
          severity: "error",
          message: "Translation contract version is not supported.",
        }],
      },
    });

    expect(parsed.readiness.readiness).toBe("degraded");
    expect(parsed.readiness.issues[0]?.severity).toBe("error");
  });

  it("rejects leaked backend payload internals", () => {
    expect(() => parseSubmitImageRunResponseDto({
      contractVersion: "image-run-api/v1",
      run: {
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        workflowId: "wf:image:restyle",
        state: "running",
        source: "api",
        submittedAt: "2026-04-08T15:00:00.000Z",
        updatedAt: "2026-04-08T15:00:30.000Z",
        backendResponsePayload: { raw: true },
      },
      mutation: {
        changed: true,
      },
    })).toThrow(ImageRunApiSchemaValidationError);
  });

  it("parses event envelopes with canonical cursors", () => {
    const parsed = parseListImageRunEventsResponseDto({
      contractVersion: "image-run-api/v1",
      items: [{
        eventId: "event:1",
        contractVersion: "image-run-api/v1",
        category: "progress",
        eventKind: "progress-updated",
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        occurredAt: "2026-04-08T15:00:15.000Z",
        sequence: 3,
        cursor: "image-run-event:3",
        payload: {
          progress: {
            state: "running",
            updatedAt: "2026-04-08T15:00:15.000Z",
            percent: 36,
            stageCode: "sampling",
          },
        },
      }],
      nextCursor: "image-run-event:3",
    });

    expect(parsed.items[0]?.sequence).toBe(3);
    expect(parsed.items[0]?.cursor).toBe("image-run-event:3");
  });
});

