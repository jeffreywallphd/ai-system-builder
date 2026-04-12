import { describe, expect, it, mock } from "bun:test";
import { ComfyUiExecutionAdapterConfig } from "@infrastructure/config/ComfyUiExecutionAdapterConfig";
import { ComfyUiRunExecutionDispatchAdapter } from "../runs/ComfyUiRunExecutionDispatchAdapter";
import { ComfyUiImageManipulationCapabilityProbeAdapter } from "../comfyui/ComfyUiImageManipulationCapabilityProbeAdapter";
import { ComfyUiExecutionCancellationAdapter } from "../comfyui/ComfyUiExecutionCancellationAdapter";
import { ComfyUiOutputDiscoveryCollector } from "../comfyui/ComfyUiOutputDiscoveryCollector";
import { createComfyUiExecutionAdapterInfrastructure } from "../comfyui/ComfyUiExecutionAdapterComposition";

describe("ComfyUiExecutionAdapterComposition", () => {
  it("returns undefined when adapter is not enabled", () => {
    const composed = createComfyUiExecutionAdapterInfrastructure({
      config: new ComfyUiExecutionAdapterConfig({
        enabled: false,
      }),
    });

    expect(composed).toBeUndefined();
  });

  it("composes transport, dispatch gateway/adapter, and capability probe adapter when enabled", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      prompt_id: "prompt-composition-1",
      number: 9,
    })));

    const composed = createComfyUiExecutionAdapterInfrastructure({
      config: new ComfyUiExecutionAdapterConfig({
        enabled: true,
        baseUrl: "http://localhost:8188/",
        requestTimeoutMs: 5000,
      }),
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T12:30:00.000Z"),
    });

    expect(composed).toBeDefined();
    expect(composed?.config.baseUrl).toBe("http://localhost:8188");
    expect(composed?.runDispatchAdapter).toBeInstanceOf(ComfyUiRunExecutionDispatchAdapter);
    expect(composed?.cancellationAdapter).toBeInstanceOf(ComfyUiExecutionCancellationAdapter);
    expect(composed?.capabilityProbeAdapter).toBeInstanceOf(ComfyUiImageManipulationCapabilityProbeAdapter);
    expect(composed?.outputDiscoveryCollector).toBeInstanceOf(ComfyUiOutputDiscoveryCollector);

    const receipt = await composed?.runDispatchAdapter.dispatch(Object.freeze({
      commandId: "run-execution-command:dispatch-attempt:77",
      dispatchAttemptId: "dispatch-attempt:77",
      preparedAt: "2026-04-08T12:29:00.000Z",
      run: Object.freeze({
        runId: "run-77",
        workflowId: "workflow:image",
        submittedAt: "2026-04-08T12:28:00.000Z",
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
            client_id: "run-77",
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

    expect(receipt?.backendRunId).toBe("prompt-composition-1");
  });
});
