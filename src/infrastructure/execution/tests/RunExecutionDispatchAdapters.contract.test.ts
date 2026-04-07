import { describe, expect, it } from "bun:test";
import { RunExecutionBackendKinds, type CanonicalRunExecutionCommand } from "@application/runs/ports/RunExecutionDispatchPorts";
import { RunExecutionDispatchRouter } from "../runs/RunExecutionDispatchRouter";
import { LocalWorkerRunExecutionDispatchAdapter } from "../runs/LocalWorkerRunExecutionDispatchAdapter";
import { RemoteRunExecutionDispatchAdapter } from "../runs/RemoteRunExecutionDispatchAdapter";
import { ComfyUiRunExecutionDispatchAdapter } from "../runs/ComfyUiRunExecutionDispatchAdapter";

function createCommand(kind: CanonicalRunExecutionCommand["backend"]["kind"]): CanonicalRunExecutionCommand {
  return Object.freeze({
    commandId: "run-execution-command:dispatch-attempt:1",
    dispatchAttemptId: "dispatch-attempt:1",
    preparedAt: "2026-04-07T09:02:00.000Z",
    run: Object.freeze({
      runId: "run-1",
      workflowId: "workflow:test",
      workspaceId: "workspace-alpha",
      submittedAt: "2026-04-07T09:00:00.000Z",
      source: "api",
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
      systemId: kind === RunExecutionBackendKinds.comfyUi ? "comfyui" : "system:test",
      versionId: "runtime:v1",
      async: kind !== RunExecutionBackendKinds.localWorker,
    }),
    backend: Object.freeze({
      kind,
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
}

describe("run execution dispatch adapter contracts", () => {
  it("translates canonical commands into local-worker payloads in infrastructure only", async () => {
    const payloads: unknown[] = [];
    const adapter = new LocalWorkerRunExecutionDispatchAdapter({
      gateway: {
        submitLocalWorkerDispatch: async (payload) => {
          payloads.push(payload);
          return Object.freeze({
            acceptedAt: "2026-04-07T09:03:00.000Z",
            backendRunId: "local-run-1",
          });
        },
      },
    });

    const receipt = await adapter.dispatch(createCommand(RunExecutionBackendKinds.localWorker));
    expect(payloads).toHaveLength(1);
    expect((payloads[0] as { nodeId?: string }).nodeId).toBe("node:trusted-a");
    expect(receipt.backendKind).toBe(RunExecutionBackendKinds.localWorker);
    expect(receipt.backendRunId).toBe("local-run-1");
  });

  it("translates canonical commands into remote-dispatch payloads in infrastructure only", async () => {
    const payloads: unknown[] = [];
    const adapter = new RemoteRunExecutionDispatchAdapter({
      gateway: {
        submitRemoteDispatch: async (payload) => {
          payloads.push(payload);
          return Object.freeze({
            acceptedAt: "2026-04-07T09:03:01.000Z",
            backendRunId: "remote-run-1",
          });
        },
      },
    });

    const receipt = await adapter.dispatch(createCommand(RunExecutionBackendKinds.remoteDispatch));
    expect(payloads).toHaveLength(1);
    expect((payloads[0] as { runRef?: { queueId?: string } }).runRef?.queueId).toBe("queue:default");
    expect(receipt.backendKind).toBe(RunExecutionBackendKinds.remoteDispatch);
    expect(receipt.backendRunId).toBe("remote-run-1");
  });

  it("translates canonical commands into ComfyUI payloads in infrastructure only", async () => {
    const payloads: unknown[] = [];
    const adapter = new ComfyUiRunExecutionDispatchAdapter({
      gateway: {
        submitComfyUiDispatch: async (payload) => {
          payloads.push(payload);
          return Object.freeze({
            acceptedAt: "2026-04-07T09:03:02.000Z",
            backendRunId: "comfy-run-1",
          });
        },
      },
    });

    const receipt = await adapter.dispatch(createCommand(RunExecutionBackendKinds.comfyUi));
    expect(payloads).toHaveLength(1);
    expect((payloads[0] as { comfyTarget?: { systemId?: string } }).comfyTarget?.systemId).toBe("comfyui");
    expect(receipt.backendKind).toBe(RunExecutionBackendKinds.comfyUi);
    expect(receipt.backendRunId).toBe("comfy-run-1");
  });

  it("routes dispatch to the registered backend adapter and rejects unregistered backends", async () => {
    const localAdapter = new LocalWorkerRunExecutionDispatchAdapter({
      gateway: {
        submitLocalWorkerDispatch: async () => Object.freeze({
          acceptedAt: "2026-04-07T09:03:00.000Z",
          backendRunId: "local-run-1",
        }),
      },
    });
    const router = new RunExecutionDispatchRouter([localAdapter]);
    const localReceipt = await router.dispatch(createCommand(RunExecutionBackendKinds.localWorker));
    expect(localReceipt.backendKind).toBe(RunExecutionBackendKinds.localWorker);

    await expect(router.dispatch(createCommand(RunExecutionBackendKinds.remoteDispatch)))
      .rejects
      .toThrow("No run execution dispatch adapter");
  });
});

