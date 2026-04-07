import { describe, expect, it } from "bun:test";
import { RunExecutionBackendKinds, type CanonicalRunExecutionCommand } from "@application/runs/ports/RunExecutionDispatchPorts";
import { DispatchAssignedRunExecutionUseCase } from "../use-cases/DispatchAssignedRunExecutionUseCase";

describe("DispatchAssignedRunExecutionUseCase", () => {
  it("dispatches through the execution dispatch port using canonical command output", async () => {
    const command: CanonicalRunExecutionCommand = Object.freeze({
      commandId: "run-execution-command:dispatch-attempt:1",
      dispatchAttemptId: "dispatch-attempt:1",
      preparedAt: "2026-04-07T09:02:00.000Z",
      run: Object.freeze({
        runId: "run-1",
        workflowId: "workflow:test",
        workspaceId: "workspace-alpha",
        submittedAt: "2026-04-07T09:00:00.000Z",
        source: "api",
        submittedByActorId: "user-owner",
        correlationId: "corr-alpha",
      }),
      queue: Object.freeze({
        queueId: "queue:default",
      }),
      assignment: Object.freeze({
        nodeId: "node:trusted-a",
        reservationOwner: "orchestrator:alpha",
        claimToken: "claim:run-1",
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:test",
        versionId: "runtime:v1",
        async: true,
      }),
      backend: Object.freeze({
        kind: RunExecutionBackendKinds.remoteDispatch,
      }),
      inputs: Object.freeze({
        tags: Object.freeze(["priority:normal"]),
        parameters: Object.freeze({ seed: 7 }),
      }),
      references: Object.freeze({
        storageReferences: Object.freeze([]),
        resourceReferences: Object.freeze([]),
        policyPrerequisites: Object.freeze([]),
      }),
    });

    const dispatchedCommands: CanonicalRunExecutionCommand[] = [];
    const useCase = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => command,
      },
      dispatchPort: {
        dispatch: async (nextCommand) => {
          dispatchedCommands.push(nextCommand);
          return Object.freeze({
            dispatchId: `dispatch:${nextCommand.dispatchAttemptId}`,
            backendKind: nextCommand.backend.kind,
            acceptedAt: "2026-04-07T09:03:00.000Z",
            status: "accepted",
            backendRunId: "remote-run-1",
          });
        },
      },
    });

    const result = await useCase.execute({
      runId: "run-1",
      dispatchAttemptId: "dispatch-attempt:1",
    });

    expect(dispatchedCommands).toHaveLength(1);
    expect(dispatchedCommands[0]).toBe(command);
    expect(result.command).toBe(command);
    expect(result.receipt.backendKind).toBe(RunExecutionBackendKinds.remoteDispatch);
    expect(result.receipt.backendRunId).toBe("remote-run-1");
  });
});

