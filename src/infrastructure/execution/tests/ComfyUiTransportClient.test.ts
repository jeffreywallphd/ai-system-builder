import { describe, expect, it, mock } from "bun:test";
import {
  ComfyUiBackendProbeStates,
  ComfyUiTransportClient,
  ComfyUiTransportClientError,
  ComfyUiTransportCancellationStatuses,
} from "../comfyui/ComfyUiTransportClient";

describe("ComfyUiTransportClient", () => {
  it("submits prompts through /prompt and returns prompt identifiers", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      prompt_id: "prompt-1",
      number: 4,
    })));
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188/",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T10:00:00.000Z"),
    });

    const result = await client.submitPrompt({
      request: Object.freeze({
        client_id: "run-1",
        prompt: Object.freeze({}),
      }),
    });

    expect(result.promptId).toBe("prompt-1");
    expect(result.acceptedAt).toBe("2026-04-08T10:00:00.000Z");
    expect(result.queueNumber).toBe(4);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8188/prompt");
    expect(init.method).toBe("POST");
  });

  it("normalizes node validation rejections", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      prompt_id: "prompt-1",
      node_errors: Object.freeze({
        "7": Object.freeze({
          type: "missing-model",
        }),
      }),
    })));
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });

    await expect(client.submitPrompt({
      request: Object.freeze({
        client_id: "run-1",
        prompt: Object.freeze({}),
      }),
    })).rejects.toBeInstanceOf(ComfyUiTransportClientError);

    try {
      await client.submitPrompt({
        request: Object.freeze({
          client_id: "run-1",
          prompt: Object.freeze({}),
        }),
      });
    } catch (error) {
      const typed = error as ComfyUiTransportClientError;
      expect(typed.code).toBe("prompt-rejected");
      expect(typed.retryable).toBeFalse();
    }
  });

  it("queries completed state from /history first", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-1": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
      }),
    })));
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T10:01:00.000Z"),
    });

    const snapshot = await client.queryPromptState({
      promptId: "prompt-1",
    });

    expect(snapshot.state).toBe("completed");
    expect(snapshot.completed).toBeTrue();
    expect(snapshot.checkedAt).toBe("2026-04-08T10:01:00.000Z");
  });

  it("falls back to /queue when history has no prompt record", async () => {
    const fetchFn = mock(async (url: string) => {
      if (url.endsWith("/history/prompt-2")) {
        return new Response(JSON.stringify({}));
      }
      return new Response(JSON.stringify({
        queue_running: Object.freeze([]),
        queue_pending: Object.freeze([
          Object.freeze(["meta", "prompt-2"]),
        ]),
      }));
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });

    const snapshot = await client.queryPromptState({
      promptId: "prompt-2",
    });

    expect(snapshot.state).toBe("queued");
    expect(snapshot.queuePosition).toBe(0);
  });

  it("queries prompt history records for output discovery", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-history-1": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
        outputs: Object.freeze({
          "9": Object.freeze({
            images: Object.freeze([
              Object.freeze({
                filename: "result.png",
                subfolder: "run",
                type: "output",
              }),
            ]),
          }),
        }),
      }),
    })));
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T10:01:30.000Z"),
    });

    const snapshot = await client.queryPromptHistory({
      promptId: "prompt-history-1",
    });

    expect(snapshot.promptId).toBe("prompt-history-1");
    expect(snapshot.checkedAt).toBe("2026-04-08T10:01:30.000Z");
    expect(snapshot.historyEntry?.outputs?.["9"]?.images?.[0]?.filename).toBe("result.png");
  });

  it("returns already-terminal cancellation when prompt is completed", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-3": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
      }),
    })));
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T10:02:00.000Z"),
    });

    const result = await client.requestPromptCancellation({
      promptId: "prompt-3",
    });

    expect(result.status).toBe(ComfyUiTransportCancellationStatuses.alreadyTerminal);
    expect(fetchFn.mock.calls.length).toBe(1);
  });

  it("requests cancellation via /interrupt for running prompts", async () => {
    const fetchFn = mock(async (url: string) => {
      if (url.endsWith("/history/prompt-4")) {
        return new Response(JSON.stringify({
          "prompt-4": Object.freeze({
            status: Object.freeze({
              completed: false,
              status_str: "running",
            }),
          }),
        }));
      }
      return new Response("");
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T10:03:00.000Z"),
    });

    const result = await client.requestPromptCancellation({
      promptId: "prompt-4",
    });

    expect(result.status).toBe(ComfyUiTransportCancellationStatuses.accepted);
    expect(fetchFn.mock.calls.length).toBe(2);
    const [interruptUrl] = fetchFn.mock.calls[1] as [string, RequestInit];
    expect(interruptUrl).toBe("http://localhost:8188/interrupt");
  });

  it("normalizes timeout failures from aborted transport requests", async () => {
    const fetchFn = mock(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      requestTimeoutMs: 1,
    });

    try {
      await client.queryPromptState({
        promptId: "prompt-timeout",
      });
      throw new Error("Expected timeout normalization.");
    } catch (error) {
      const typed = error as ComfyUiTransportClientError;
      expect(typed.code).toBe("request-timeout");
      expect(typed.retryable).toBeTrue();
    }
  });

  it("reports ready backend probe state when reachability and required capabilities are present", async () => {
    const fetchFn = mock(async (url: string) => {
      if (url.endsWith("/queue")) {
        return new Response(JSON.stringify({
          queue_running: [],
          queue_pending: [],
        }));
      }
      return new Response(JSON.stringify({
        LoadImage: Object.freeze({}),
        SaveImage: Object.freeze({}),
      }));
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T10:04:00.000Z"),
    });

    const probe = await client.probeBackend({
      requiredNodeTypes: Object.freeze(["LoadImage", "SaveImage"]),
    });

    expect(probe.state).toBe(ComfyUiBackendProbeStates.ready);
    expect(probe.reachable).toBeTrue();
    expect(probe.responsive).toBeTrue();
    expect(probe.capabilities.supportsCapabilityDiscovery).toBeTrue();
    expect(probe.capabilities.missingRequiredNodeTypes).toEqual([]);
  });

  it("reports degraded backend probe state when capability discovery fails", async () => {
    const fetchFn = mock(async (url: string) => {
      if (url.endsWith("/queue")) {
        return new Response(JSON.stringify({
          queue_running: [],
          queue_pending: [],
        }));
      }
      return new Response("not found", {
        status: 404,
      });
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });

    const probe = await client.probeBackend({
      requiredNodeTypes: Object.freeze(["LoadImage"]),
    });

    expect(probe.state).toBe(ComfyUiBackendProbeStates.degraded);
    expect(probe.reachable).toBeTrue();
    expect(probe.responsive).toBeTrue();
    expect(probe.capabilities.supportsCapabilityDiscovery).toBeFalse();
  });

  it("reports unavailable backend probe state when reachability check fails", async () => {
    const fetchFn = mock(async () => {
      throw new Error("ECONNREFUSED");
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });

    const probe = await client.probeBackend({
      requiredNodeTypes: Object.freeze(["LoadImage"]),
    });

    expect(probe.state).toBe(ComfyUiBackendProbeStates.unavailable);
    expect(probe.reachable).toBeFalse();
    expect(probe.responsive).toBeFalse();
    expect(probe.capabilities.missingRequiredNodeTypes).toEqual(["LoadImage"]);
  });

  it("reports incompatible backend probe state when required node capabilities are missing", async () => {
    const fetchFn = mock(async (url: string) => {
      if (url.endsWith("/queue")) {
        return new Response(JSON.stringify({
          queue_running: [],
          queue_pending: [],
        }));
      }
      return new Response(JSON.stringify({
        LoadImage: Object.freeze({}),
      }));
    });
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });

    const probe = await client.probeBackend({
      requiredNodeTypes: Object.freeze(["LoadImage", "SaveImage"]),
    });

    expect(probe.state).toBe(ComfyUiBackendProbeStates.incompatible);
    expect(probe.reachable).toBeTrue();
    expect(probe.responsive).toBeTrue();
    expect(probe.capabilities.missingRequiredNodeTypes).toEqual(["SaveImage"]);
  });

  it("applies bearer authorization header when an auth token is configured", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      prompt_id: "prompt-auth-1",
    })));
    const client = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      authToken: "token-123",
      fetch: fetchFn as unknown as typeof fetch,
    });

    await client.submitPrompt({
      request: Object.freeze({
        client_id: "run-auth",
        prompt: Object.freeze({}),
      }),
    });

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });
});
