import { describe, expect, it } from "bun:test";
import { RunExecutionBackendKinds } from "@application/runs/ports/RunExecutionDispatchPorts";
import { ImageManipulationExecutionCancellationStatuses } from "@application/image-workflows/ports";
import { ComfyUiRunExecutionDispatchAdapter } from "../runs/ComfyUiRunExecutionDispatchAdapter";
import { createAuthoritativeRunExecutionAdapterRegistration } from "../runs/AuthoritativeRunExecutionAdapterRegistration";

describe("AuthoritativeRunExecutionAdapterRegistration", () => {
  it("returns undefined when no execution adapters are composed", () => {
    const registration = createAuthoritativeRunExecutionAdapterRegistration({});
    expect(registration).toBeUndefined();
  });

  it("registers ComfyUI dispatch and cancellation ports when ComfyUI infrastructure is available", async () => {
    const registration = createAuthoritativeRunExecutionAdapterRegistration({
      comfyUiExecutionAdapter: {
        runDispatchAdapter: new ComfyUiRunExecutionDispatchAdapter({
          gateway: {
            submitComfyUiDispatch: async () => Object.freeze({
              acceptedAt: "2026-04-08T16:00:00.000Z",
              backendRunId: "prompt-registration-1",
            }),
          },
        }),
        cancellationAdapter: {
          requestExecutionCancellation: async () => Object.freeze({
            status: ImageManipulationExecutionCancellationStatuses.accepted,
            acknowledgedAt: "2026-04-08T16:01:00.000Z",
            message: "accepted",
          }),
        },
        capabilityProbeAdapter: {
          getExecutionBackendStatus: async () => Object.freeze({
            backendFamily: "adapter.comfyui.image-manipulation",
            health: "healthy",
            checkedAt: "2026-04-08T16:01:10.000Z",
            capabilities: Object.freeze({
              backendFamily: "adapter.comfyui.image-manipulation",
              supportsProgressPolling: true,
              supportsProgressStreaming: false,
              supportsCancellation: true,
              supportsOutputDiscovery: true,
              supportedOperationKinds: Object.freeze(["image-to-image"]),
              supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
            }),
          }),
        },
      } as never,
    });

    expect(registration).toBeDefined();
    expect(registration?.registeredBackendKinds).toEqual([RunExecutionBackendKinds.comfyUi]);
    expect(registration?.capabilityProbePort).toBeDefined();

    const receipt = await registration?.dispatchPort?.dispatch(Object.freeze({
      commandId: "run-execution-command:dispatch-attempt:99",
      dispatchAttemptId: "dispatch-attempt:99",
      preparedAt: "2026-04-08T15:59:00.000Z",
      run: Object.freeze({
        runId: "run-99",
        workflowId: "workflow:image",
        workspaceId: "workspace-alpha",
        submittedAt: "2026-04-08T15:58:00.000Z",
        source: "api",
      }),
      queue: Object.freeze({
        queueId: "queue:images",
      }),
      assignment: Object.freeze({
        nodeId: "node-1",
        reservationOwner: "scheduler",
        claimToken: "claim-1",
      }),
      runtimeTarget: Object.freeze({
        systemId: "comfyui",
        versionId: "runtime:v1",
        async: true,
      }),
      backend: Object.freeze({
        kind: "comfyui",
      }),
      inputs: Object.freeze({
        tags: Object.freeze([]),
        parameters: Object.freeze({
          "comfy.request": Object.freeze({
            client_id: "run-99",
            prompt: Object.freeze({}),
          }),
        }),
      }),
      references: Object.freeze({
        storageReferences: Object.freeze([]),
        resourceReferences: Object.freeze([]),
        policyPrerequisites: Object.freeze([]),
      }),
    }));
    expect(receipt?.backendKind).toBe(RunExecutionBackendKinds.comfyUi);

    const cancellation = await registration?.cancellationSignalPort?.signalCancellation({
      runId: "run-99",
      workflowId: "workflow:image",
      workspaceId: "workspace-alpha",
      state: "running",
      backendKind: RunExecutionBackendKinds.comfyUi,
      backendRunId: "prompt-registration-1",
      requestedAt: "2026-04-08T16:01:00.000Z",
    });
    expect(cancellation?.status).toBe("accepted");

    const status = await registration?.capabilityProbePort?.getExecutionBackendStatus({
      workspaceId: "workspace-alpha",
    });
    expect(status?.backendFamily).toContain("comfyui");
  });
});
