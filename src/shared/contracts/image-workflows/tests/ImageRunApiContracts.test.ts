import { describe, expect, it } from "bun:test";
import {
  ImageRunReadinessStates,
  buildImageRunEventCursor,
  ImageRunSubmissionReadinessIssueCategories,
  ImageRunSubmissionReadinessIssueSeverities,
  ImageRunSubmissionReadinessStates,
  parseImageRunEventCursor,
  toListImageRunEventsQueryParams,
  toListImageRunsQueryParams,
} from "../ImageRunApiContracts";
import type { ImageRunSubmissionBackendReadinessDependencyDto } from "../ImageRunApiContracts";

describe("ImageRunApiContracts", () => {
  it("serializes list-runs query params with repeated filter values", () => {
    const query = toListImageRunsQueryParams({
      contractVersion: "image-run-api/v1",
      workspaceId: "workspace:alpha",
      systemId: "system:portrait-restyle",
      states: ["queued", "running"],
      sources: ["api", "ui-manual"],
      search: "portrait",
      limit: 25,
      offset: 10,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    expect(query.get("workspaceId")).toBe("workspace:alpha");
    expect(query.get("systemId")).toBe("system:portrait-restyle");
    expect(query.getAll("state")).toEqual(["queued", "running"]);
    expect(query.getAll("source")).toEqual(["api", "ui-manual"]);
    expect(query.get("sortBy")).toBe("updatedAt");
    expect(query.get("sortDirection")).toBe("desc");
  });

  it("serializes list-run-events query params", () => {
    const query = toListImageRunEventsQueryParams({
      contractVersion: "image-run-api/v1",
      workspaceId: "workspace:alpha",
      runId: "run:image:1",
      afterCursor: "image-run-event:4",
      limit: 50,
    });

    expect(query.get("workspaceId")).toBe("workspace:alpha");
    expect(query.get("runId")).toBe("run:image:1");
    expect(query.get("afterCursor")).toBe("image-run-event:4");
    expect(query.get("limit")).toBe("50");
  });

  it("builds and parses canonical run-event cursors", () => {
    const cursor = buildImageRunEventCursor(7.9);
    expect(cursor).toBe("image-run-event:7");
    expect(parseImageRunEventCursor(cursor)).toBe(7);
    expect(parseImageRunEventCursor("image-run-event:not-a-number")).toBeUndefined();
  });

  it("exposes canonical submission-readiness taxonomy constants", () => {
    expect(ImageRunSubmissionReadinessStates.blocked).toBe("blocked");
    expect(ImageRunSubmissionReadinessIssueCategories.policyDenial).toBe("policy-denial");
    expect(ImageRunSubmissionReadinessIssueSeverities.warning).toBe("warning");
  });

  it("keeps readiness contracts resilience-aware for API and presenter consumers", () => {
    const backendDependency: ImageRunSubmissionBackendReadinessDependencyDto = {
      adapterHealth: "degraded",
      ready: true,
      issues: [],
      resilience: {
        observedAt: "2026-04-08T12:30:00.000Z",
        state: "degraded",
        usable: true,
        partiallyUsable: true,
        conditions: [{
          code: "backend-degraded",
          scope: "execution-availability",
          state: "degraded",
          summary: "Backend is reachable but degraded.",
          observedAt: "2026-04-08T12:30:00.000Z",
          durability: "temporary",
          recovery: {
            kind: "retry",
            retryable: true,
            blocking: false,
          },
        }],
        degradedConditions: [],
        blockedConditions: [],
        unavailableConditions: [],
      },
    };

    expect(ImageRunReadinessStates.degraded).toBe("degraded");
    expect(backendDependency.resilience?.state).toBe("degraded");
  });

  it("allows failure payloads to carry shared retry/recovery/escalation guidance", () => {
    const failure = {
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
      failedAt: "2026-04-08T12:30:00.000Z",
      partialProgressObserved: true,
      partialOutputCount: 0,
      visibility: "user-safe",
    } as const;

    expect(failure.recovery.retry.retryMode).toBe("automatic");
    expect(failure.recovery.recoveryAction.kind).toBe("retry-automatic");
    expect(failure.recovery.escalation.required).toBeFalse();
  });
});

