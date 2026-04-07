import { describe, expect, it } from "bun:test";
import { createSystemExecution } from "@domain/system-runtime/SystemRuntimeDomain";
import { createSystemStudioTaxonomy } from "@domain/system-studio/SystemAssetDomain";
import { InMemorySystemRuntimeExecutionStore } from "../SystemRuntimeExecutionStore";

function createExecution(executionId: string, startedAt: string) {
  return createSystemExecution({
    executionId,
    root: {
      assetId: "system:test",
      versionId: "system:test:v1",
      taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
    },
    input: { payload: {}, capturedAt: startedAt },
    startedAt,
    updatedAt: startedAt,
    status: "succeeded",
  });
}

describe("InMemorySystemRuntimeExecutionStore", () => {
  it("prunes oldest records when bounded capacity is exceeded", () => {
    const store = new InMemorySystemRuntimeExecutionStore(2);
    const first = createExecution("exec:1", "2026-03-28T00:00:00.000Z");
    const second = createExecution("exec:2", "2026-03-28T00:00:01.000Z");
    const third = createExecution("exec:3", "2026-03-28T00:00:02.000Z");

    const toRecord = (execution: ReturnType<typeof createExecution>) => ({
      executionId: execution.executionId,
      execution,
      metadata: {
        executionId: execution.executionId,
        rootAssetId: execution.root.assetId,
        rootVersionId: execution.root.versionId,
        status: execution.status,
        startedAt: execution.startedAt,
        updatedAt: execution.updatedAt,
        trace: { eventCount: 0, logCount: 0 },
        result: { hasOutput: false, hasError: false },
        executedVersionMap: { rootVersionId: execution.root.versionId, nodeVersionIds: {} },
        childExecutionIds: [],
      },
    } as const);

    store.saveExecutionRecord(toRecord(first));
    store.saveExecutionRecord(toRecord(second));
    store.saveExecutionRecord(toRecord(third));

    expect(store.getExecutionRecord("exec:1")).toBeUndefined();
    expect(store.getExecutionRecord("exec:2")).toBeDefined();
    expect(store.getExecutionRecord("exec:3")).toBeDefined();
  });
});

