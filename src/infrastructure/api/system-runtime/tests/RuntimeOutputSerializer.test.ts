import { describe, expect, it } from "bun:test";
import type { RuntimeExecutionResultReadModel } from "@application/system-runtime/SystemRuntimeApplicationService";
import { RuntimeOutputSerializer } from "../RuntimeOutputSerializer";

function createResultModel(): RuntimeExecutionResultReadModel {
  return Object.freeze({
    executionId: "exec-1",
    status: "succeeded",
    output: Object.freeze({
      payload: Object.freeze({
        response: "ok",
        nodeResults: {},
        contractOutputs: ["response"],
      }),
      producedAt: "2026-03-28T00:00:00.000Z",
    }),
    rootAssetId: "system:demo",
    rootVersionId: "system:demo:v1",
    completedAt: "2026-03-28T00:00:01.000Z",
    outputSummary: Object.freeze({
      hasOutput: true,
      hasError: false,
      outputFieldCount: 1,
      contractOutputIds: Object.freeze(["response"]),
    }),
    nodeResults: Object.freeze([
      Object.freeze({
        nodeId: "node-1",
        path: Object.freeze(["root", "node-1"]),
        structuralKind: "atomic",
        semanticRole: "model",
        status: "succeeded",
        outputSummary: "ok",
        hasOutput: true,
        hasError: false,
      }),
    ]),
    nestedSystemResults: Object.freeze([]),
    diagnostics: Object.freeze([
      Object.freeze({
        source: "trace-log",
        severity: "warning",
        message: "bounded warning",
      }),
    ]),
    executedVersionMap: Object.freeze({
      rootVersionId: "system:demo:v1",
      nodeVersionIds: Object.freeze({ "node-1": "asset:model:v1" }),
    }),
  });
}

describe("RuntimeOutputSerializer", () => {
  it("serializes runtime result read models into deterministic external envelopes", () => {
    const serializer = new RuntimeOutputSerializer();
    const serialized = serializer.serialize(createResultModel());

    expect(serialized.identity.executionId).toBe("exec-1");
    expect(serialized.identity.executedVersionMap.rootVersionId).toBe("system:demo:v1");
    expect(serialized.summary.nodeResultCount).toBe(1);
    expect(serialized.outputs[0]?.outputId).toBe("response");
    expect(serialized.outputs[0]?.produced).toBeTrue();
    expect(serialized.diagnostics.warningCount).toBe(1);
  });
});

