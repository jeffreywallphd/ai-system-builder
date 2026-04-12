import { describe, expect, it } from "bun:test";
import { AssetId } from "../../assets/AssetId";
import {
  ImageRunLifecycleTransitionError,
  ImageRunStatuses,
  createImageRunRecord,
  isImageRunLifecycleTransitionAllowed,
  transitionImageRunRecord,
} from "../ImageRunDomain";

describe("ImageRunDomain", () => {
  function createDraftRun() {
    return createImageRunRecord({
      identity: {
        runId: "run:image:001",
        workspaceId: "workspace:alpha",
        ownerUserId: "user:owner",
      },
      composition: {
        systemId: "system:image:retouch",
        workflowId: "workflow:image:retouch:v2",
        workflowTemplateId: "template:image:retouch",
      },
      inputAssetBindings: [
        {
          bindingId: "input-base",
          role: "source-image",
          assetId: new AssetId("asset:image:raw:1"),
          assetVersionId: "v1",
        },
      ],
      parameterSnapshot: {
        prompt: "remove background",
        strength: 0.72,
        toggles: {
          preserveSkin: true,
        },
      },
      createdAt: "2026-04-08T13:00:00.000Z",
      createdBy: "user:owner",
    });
  }

  it("creates a draft image run with authoritative ownership, scope, and logical references", () => {
    const run = createDraftRun();

    expect(run.status).toBe(ImageRunStatuses.draft);
    expect(run.identity.workspaceId).toBe("workspace:alpha");
    expect(run.identity.ownerUserId).toBe("user:owner");
    expect(run.composition.systemId).toBe("system:image:retouch");
    expect(run.composition.workflowId).toBe("workflow:image:retouch:v2");
    expect(run.inputAssetBindings[0]?.assetId.toString()).toBe("asset:image:raw:1");
    expect(run.statusHistory).toHaveLength(1);
  });

  it("supports requested/validating/queued/dispatching/running/completed lifecycle progression", () => {
    const draft = createDraftRun();
    const requested = transitionImageRunRecord(draft, {
      toStatus: ImageRunStatuses.requested,
      occurredAt: "2026-04-08T13:00:01.000Z",
      changedBy: "user:owner",
      reason: "submit",
    });
    const validating = transitionImageRunRecord(requested, {
      toStatus: ImageRunStatuses.validating,
      occurredAt: "2026-04-08T13:00:02.000Z",
      changedBy: "system:validator",
    });
    const queued = transitionImageRunRecord(validating, {
      toStatus: ImageRunStatuses.queued,
      occurredAt: "2026-04-08T13:00:03.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: {
        queueId: "queue:image-default",
      },
    });
    const dispatching = transitionImageRunRecord(queued, {
      toStatus: ImageRunStatuses.dispatching,
      occurredAt: "2026-04-08T13:00:04.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: {
        queueId: "queue:image-default",
        dispatchId: "dispatch:1",
        nodeId: "node:gpu:1",
      },
    });
    const running = transitionImageRunRecord(dispatching, {
      toStatus: ImageRunStatuses.running,
      occurredAt: "2026-04-08T13:00:05.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: {
        queueId: "queue:image-default",
        dispatchId: "dispatch:1",
        nodeId: "node:gpu:1",
        adapterKind: "comfyui",
        adapterRunId: "comfy:run:777",
      },
    });
    const completed = transitionImageRunRecord(running, {
      toStatus: ImageRunStatuses.completed,
      occurredAt: "2026-04-08T13:00:20.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: running.executionLinkage,
      resultLineage: {
        outputAssetIds: [new AssetId("asset:image:output:1")],
        parentRunId: "run:image:base",
      },
    });

    expect(completed.status).toBe(ImageRunStatuses.completed);
    expect(completed.statusTimestamps.requestedAt).toBe("2026-04-08T13:00:01.000Z");
    expect(completed.statusTimestamps.startedAt).toBe("2026-04-08T13:00:05.000Z");
    expect(completed.statusTimestamps.completedAt).toBe("2026-04-08T13:00:20.000Z");
    expect(completed.statusHistory).toHaveLength(7);
    expect(completed.resultLineage?.outputAssetIds[0]?.toString()).toBe("asset:image:output:1");
  });

  it("supports degraded and partially-completed terminal outcomes with failure summary", () => {
    const running = transitionImageRunRecord(
      transitionImageRunRecord(
        transitionImageRunRecord(
          transitionImageRunRecord(
            transitionImageRunRecord(createDraftRun(), {
              toStatus: ImageRunStatuses.requested,
              occurredAt: "2026-04-08T13:10:01.000Z",
              changedBy: "user:owner",
            }),
            {
              toStatus: ImageRunStatuses.validating,
              occurredAt: "2026-04-08T13:10:02.000Z",
              changedBy: "system:validator",
            },
          ),
          {
            toStatus: ImageRunStatuses.queued,
            occurredAt: "2026-04-08T13:10:03.000Z",
            changedBy: "system:orchestrator",
            executionLinkage: { queueId: "queue:image-default" },
          },
        ),
        {
          toStatus: ImageRunStatuses.dispatching,
          occurredAt: "2026-04-08T13:10:04.000Z",
          changedBy: "system:orchestrator",
          executionLinkage: { queueId: "queue:image-default", dispatchId: "dispatch:2", nodeId: "node:gpu:2" },
        },
      ),
      {
        toStatus: ImageRunStatuses.running,
        occurredAt: "2026-04-08T13:10:05.000Z",
        changedBy: "system:orchestrator",
        executionLinkage: {
          queueId: "queue:image-default",
          dispatchId: "dispatch:2",
          nodeId: "node:gpu:2",
          adapterKind: "comfyui",
          adapterRunId: "comfy:run:888",
        },
      },
    );

    const degraded = transitionImageRunRecord(running, {
      toStatus: ImageRunStatuses.degraded,
      occurredAt: "2026-04-08T13:10:12.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: running.executionLinkage,
      failureSummary: {
        code: "upstream-timeout",
        message: "One optional branch timed out.",
        failedAt: "2026-04-08T13:10:12.000Z",
        recoverable: true,
      },
    });

    const partial = transitionImageRunRecord(degraded, {
      toStatus: ImageRunStatuses.partiallyCompleted,
      occurredAt: "2026-04-08T13:10:20.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: degraded.executionLinkage,
      failureSummary: {
        code: "optional-stage-missing",
        message: "Primary output created without secondary variants.",
        failedAt: "2026-04-08T13:10:20.000Z",
        recoverable: true,
      },
    });

    expect(partial.status).toBe(ImageRunStatuses.partiallyCompleted);
    expect(partial.failureSummary?.recoverable).toBeTrue();
    expect(partial.statusTimestamps.degradedAt).toBe("2026-04-08T13:10:12.000Z");
    expect(partial.statusTimestamps.partiallyCompletedAt).toBe("2026-04-08T13:10:20.000Z");
  });

  it("rejects invalid transitions and invalid canonical asset references", () => {
    const draft = createDraftRun();

    expect(() => transitionImageRunRecord(draft, {
      toStatus: ImageRunStatuses.running,
      occurredAt: "2026-04-08T13:20:00.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: {
        dispatchId: "dispatch:bad",
        adapterKind: "comfyui",
        adapterRunId: "comfy:bad",
      },
    })).toThrow(ImageRunLifecycleTransitionError);

    expect(() => createImageRunRecord({
      identity: {
        runId: "run:image:bad-asset",
        workspaceId: "workspace:alpha",
        ownerUserId: "user:owner",
      },
      composition: {
        systemId: "system:image:retouch",
        workflowId: "workflow:image:retouch:v2",
      },
      inputAssetBindings: [
        {
          bindingId: "bad",
          role: "source-image",
          assetId: new AssetId("image:raw:missing-prefix"),
        },
      ],
      parameterSnapshot: { prompt: "x" },
      createdAt: "2026-04-08T13:20:00.000Z",
      createdBy: "user:owner",
    })).toThrow("canonical asset id format");
  });

  it("enforces failure metadata and execution linkage invariants", () => {
    const queued = transitionImageRunRecord(
      transitionImageRunRecord(
        transitionImageRunRecord(createDraftRun(), {
          toStatus: ImageRunStatuses.requested,
          occurredAt: "2026-04-08T13:30:01.000Z",
          changedBy: "user:owner",
        }),
        {
          toStatus: ImageRunStatuses.validating,
          occurredAt: "2026-04-08T13:30:02.000Z",
          changedBy: "system:validator",
        },
      ),
      {
        toStatus: ImageRunStatuses.queued,
        occurredAt: "2026-04-08T13:30:03.000Z",
        changedBy: "system:orchestrator",
        executionLinkage: { queueId: "queue:image-default" },
      },
    );

    expect(isImageRunLifecycleTransitionAllowed(ImageRunStatuses.queued, ImageRunStatuses.dispatching)).toBeTrue();
    expect(isImageRunLifecycleTransitionAllowed(ImageRunStatuses.queued, ImageRunStatuses.completed)).toBeFalse();

    expect(() => transitionImageRunRecord(queued, {
      toStatus: ImageRunStatuses.dispatching,
      occurredAt: "2026-04-08T13:30:04.000Z",
      changedBy: "system:orchestrator",
      executionLinkage: { queueId: "queue:image-default" },
    })).toThrow("requires executionLinkage.dispatchId");

    expect(() => transitionImageRunRecord(queued, {
      toStatus: ImageRunStatuses.failed,
      occurredAt: "2026-04-08T13:30:05.000Z",
      changedBy: "system:orchestrator",
    })).toThrow("requires failureSummary");
  });
});
