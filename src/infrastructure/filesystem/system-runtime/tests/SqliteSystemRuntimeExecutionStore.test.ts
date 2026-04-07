import { describe, expect, it } from "bun:test";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createSystemStudioTaxonomy } from "../../../../src/domain/system-studio/SystemAssetDomain";
import { createSystemExecution } from "../../../../src/domain/system-runtime/SystemRuntimeDomain";
import { SqliteSystemRuntimeExecutionStore } from "../SqliteSystemRuntimeExecutionStore";

function createExecution(executionId: string, rootVersionId = "system:root:v1") {
  return createSystemExecution({
    executionId,
    root: {
      assetId: "system:root",
      versionId: rootVersionId,
      taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
    },
    context: {
      trigger: "manual",
      metadata: { parentExecutionId: "parent:exec", parentNodeId: "node:child" },
    },
    environment: { environmentId: "runtime:local" },
    input: { payload: { prompt: "hi" }, capturedAt: "2026-03-28T00:00:00.000Z" },
    output: {
      producedAt: "2026-03-28T00:00:01.000Z",
      payload: {
        nodeResults: {
          "component:child": {
            nestedExecution: { executionId: "child:exec:1" },
          },
        },
      },
    },
    startedAt: "2026-03-28T00:00:00.000Z",
    updatedAt: "2026-03-28T00:00:01.000Z",
    completedAt: "2026-03-28T00:00:01.000Z",
    status: "succeeded",
  });
}

describe("SqliteSystemRuntimeExecutionStore", () => {
  it("persists and reloads bounded execution metadata with version-aware identity", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-runtime-store-"));
    try {
      const store = new SqliteSystemRuntimeExecutionStore(path.join(root, "system-runtime.sqlite"));
      const execution = createExecution("exec:1", "system:root:v9");

      store.saveExecutionRecord({
        executionId: execution.executionId,
        execution,
        metadata: {
          executionId: execution.executionId,
          rootAssetId: execution.root.assetId,
          rootVersionId: execution.root.versionId,
          status: execution.status,
          startedAt: execution.startedAt,
          updatedAt: execution.updatedAt,
          completedAt: execution.completedAt,
          environmentId: execution.environment?.environmentId,
          trace: { eventCount: 3, logCount: 2, lastEventAt: execution.updatedAt },
          result: { hasOutput: true, hasError: false, outputSummary: "Object(1 fields)" },
          executedVersionMap: {
            rootVersionId: "system:root:v9",
            nodeVersionIds: { "component:child": "system:child:v1" },
          },
          parentExecutionId: "parent:exec",
          parentNodeId: "node:child",
          childExecutionIds: ["child:exec:1"],
        },
      });

      const reloaded = store.getExecutionRecord("exec:1");
      expect(reloaded?.execution.root.versionId).toBe("system:root:v9");
      expect(reloaded?.metadata.executedVersionMap.nodeVersionIds["component:child"]).toBe("system:child:v1");
      expect(reloaded?.metadata.trace.eventCount).toBe(3);
      expect(reloaded?.metadata.childExecutionIds).toContain("child:exec:1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists recent executions per system and optional version", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-runtime-store-list-"));
    try {
      const store = new SqliteSystemRuntimeExecutionStore(path.join(root, "system-runtime.sqlite"));
      const first = createExecution("exec:a", "system:root:v1");
      const second = createExecution("exec:b", "system:root:v2");

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
          completedAt: execution.completedAt,
          trace: { eventCount: 1, logCount: 1 },
          result: { hasOutput: true, hasError: false },
          executedVersionMap: { rootVersionId: execution.root.versionId, nodeVersionIds: {} },
          childExecutionIds: [],
        },
      } as const);

      store.saveExecutionRecord(toRecord(first));
      store.saveExecutionRecord(toRecord(second));

      const all = store.listExecutionRecordsForSystem({ assetId: "system:root", limit: 10 });
      const v2Only = store.listExecutionRecordsForSystem({ assetId: "system:root", versionId: "system:root:v2" });

      expect(all.length).toBe(2);
      expect(v2Only.length).toBe(1);
      expect(v2Only[0]?.executionId).toBe("exec:b");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prunes oldest persisted records when capacity is exceeded", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-runtime-store-prune-"));
    try {
      const store = new SqliteSystemRuntimeExecutionStore(path.join(root, "system-runtime.sqlite"), 2);
      const first = createExecution("exec:prune:1", "system:root:v1");
      const second = createExecution("exec:prune:2", "system:root:v1");
      const third = createExecution("exec:prune:3", "system:root:v1");
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
          completedAt: execution.completedAt,
          trace: { eventCount: 1, logCount: 1 },
          result: { hasOutput: true, hasError: false },
          executedVersionMap: { rootVersionId: execution.root.versionId, nodeVersionIds: {} },
          childExecutionIds: [],
        },
      } as const);

      store.saveExecutionRecord(toRecord(first));
      store.saveExecutionRecord(toRecord(second));
      store.saveExecutionRecord(toRecord(third));

      expect(store.getExecutionRecord("exec:prune:1")).toBeUndefined();
      expect(store.getExecutionRecord("exec:prune:2")).toBeDefined();
      expect(store.getExecutionRecord("exec:prune:3")).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
