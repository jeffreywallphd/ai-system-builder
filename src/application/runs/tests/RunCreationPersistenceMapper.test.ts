import { describe, expect, it } from "bun:test";
import { RunLifecycleStates } from "@domain/runs/RunDomain";
import { PlatformRunStatuses } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { CanonicalRunSubmissionCommand } from "../use-cases/RunSubmissionValidationContracts";
import {
  createInitialCanonicalRunRecord,
  mapCanonicalRunToPlatformRecord,
  mapLifecycleStateToPlatformRunStatus,
  mapPlatformRunRecordToCanonicalRun,
  mapPlatformRunStatusToLifecycleState,
} from "../use-cases/RunCreationPersistenceMapper";

function createCommand(): CanonicalRunSubmissionCommand {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:alpha",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow-alpha",
    source: "api",
    runtimeTarget: Object.freeze({
      systemId: "system-alpha",
      versionId: "system-alpha:v1",
      async: true,
    }),
    tags: Object.freeze([]),
    parameters: Object.freeze({ seed: 42 }),
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({}),
    occurredAt: "2026-04-07T15:00:00.000Z",
  });
}

describe("RunCreationPersistenceMapper", () => {
  it("round-trips canonical run state through platform metadata", () => {
    const command = createCommand();
    const canonical = createInitialCanonicalRunRecord(command, "run-1");
    const platform = mapCanonicalRunToPlatformRecord({
      command,
      run: canonical,
      queueId: "queue:default",
    });
    const reconstructed = mapPlatformRunRecordToCanonicalRun(platform);

    expect(reconstructed.identity.runId).toBe("run-1");
    expect(reconstructed.state).toBe("submitted");
    expect(reconstructed.submission.source).toBe("api");
    expect(reconstructed.identity.workspaceId).toBe("workspace-alpha");
  });

  it("maps run lifecycle states to platform statuses and back", () => {
    expect(mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.submitted)).toBe(PlatformRunStatuses.pending);
    expect(mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.running)).toBe(PlatformRunStatuses.running);
    expect(mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.completed)).toBe(PlatformRunStatuses.completed);
    expect(mapPlatformRunStatusToLifecycleState(PlatformRunStatuses.pending)).toBe(RunLifecycleStates.submitted);
    expect(mapPlatformRunStatusToLifecycleState(PlatformRunStatuses.running)).toBe(RunLifecycleStates.running);
    expect(mapPlatformRunStatusToLifecycleState(PlatformRunStatuses.failed)).toBe(RunLifecycleStates.failed);
  });
});

