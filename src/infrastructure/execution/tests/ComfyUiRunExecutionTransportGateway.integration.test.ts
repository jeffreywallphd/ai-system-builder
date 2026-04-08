import { describe, expect, it, mock } from "bun:test";
import { RunExecutionBackendKinds, type CanonicalRunExecutionCommand } from "@application/runs/ports/RunExecutionDispatchPorts";
import { ComfyUiTransportClient } from "../comfyui/ComfyUiTransportClient";
import { ComfyUiRunExecutionDispatchAdapter } from "../runs/ComfyUiRunExecutionDispatchAdapter";
import { ComfyUiRunExecutionTransportGateway } from "../runs/ComfyUiRunExecutionTransportGateway";

function createCommand(parameters: Readonly<Record<string, unknown>>): CanonicalRunExecutionCommand {
  return Object.freeze({
    commandId: "run-execution-command:dispatch-attempt:2",
    dispatchAttemptId: "dispatch-attempt:2",
    preparedAt: "2026-04-08T12:00:00.000Z",
    run: Object.freeze({
      runId: "run-2",
      workflowId: "workflow:image",
      workspaceId: "workspace-beta",
      submittedAt: "2026-04-08T11:59:00.000Z",
      source: "api",
      correlationId: "corr-2",
    }),
    queue: Object.freeze({
      queueId: "queue:images",
    }),
    assignment: Object.freeze({
      nodeId: "node:trusted-2",
      reservationOwner: "orchestrator:beta",
      claimToken: "claim:run-2",
    }),
    runtimeTarget: Object.freeze({
      systemId: "comfyui",
      versionId: "runtime:v2",
      async: true,
    }),
    backend: Object.freeze({
      kind: RunExecutionBackendKinds.comfyUi,
    }),
    inputs: Object.freeze({
      tags: Object.freeze(["priority:high"]),
      parameters,
    }),
    references: Object.freeze({
      storageReferences: Object.freeze([]),
      resourceReferences: Object.freeze([]),
      policyPrerequisites: Object.freeze([]),
    }),
  });
}

describe("ComfyUiRunExecutionTransportGateway integration", () => {
  it("submits translated comfy payloads through the concrete transport client", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      prompt_id: "prompt-transport-1",
      number: 12,
    })));
    const transport = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T12:01:00.000Z"),
    });
    const gateway = new ComfyUiRunExecutionTransportGateway(transport);
    const adapter = new ComfyUiRunExecutionDispatchAdapter({
      gateway,
    });

    const receipt = await adapter.dispatch(createCommand(Object.freeze({
      "comfy.request": Object.freeze({
        client_id: "run-2",
        prompt: Object.freeze({
          "1": Object.freeze({
            class_type: "LoadImage",
            inputs: Object.freeze({
              image: "asset://source",
            }),
          }),
        }),
      }),
    })));

    expect(receipt.backendRunId).toBe("prompt-transport-1");
    expect(receipt.status).toBe("accepted");
    expect(receipt.acceptedAt).toBe("2026-04-08T12:01:00.000Z");
    const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8188/prompt");
  });

  it("fails closed when translated comfy payload is missing", async () => {
    const transport = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: mock(async () => new Response(JSON.stringify({
        prompt_id: "unused",
      }))) as unknown as typeof fetch,
    });
    const gateway = new ComfyUiRunExecutionTransportGateway(transport);
    const adapter = new ComfyUiRunExecutionDispatchAdapter({
      gateway,
    });

    await expect(adapter.dispatch(createCommand(Object.freeze({
      seed: 77,
    })))).rejects.toThrow("comfy.request");
  });
});
