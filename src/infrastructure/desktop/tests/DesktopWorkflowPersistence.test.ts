import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DesktopWorkflowPersistence } from "../DesktopWorkflowPersistence";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

const workflowRecordJson = JSON.stringify({
  id: "wf-desktop",
  metadata: {
    name: "Desktop Workflow",
    description: "Desktop workflow record",
    version: "1.0.0",
    tags: [],
  },
  nodes: [
    {
      id: "node-1",
      type: "test.node",
      metadata: { label: "Node 1", category: "utility", icon: "test" },
      position: { x: 0, y: 0 },
      config: {},
      inputs: {},
      outputs: {},
    },
  ],
  edges: [],
  status: "draft",
  isEnabled: true,
});

describe("DesktopWorkflowPersistence", () => {
  it("falls back to canonical JSON scans when SQLite index initialization fails", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-workflow-fallback-"));
    tempRoots.push(root);

    const persistence = new DesktopWorkflowPersistence({
      workflowsDirectory: path.join(root, "workflows"),
      indexDatabasePath: path.join(root, "workflows", "workflow-index.sqlite"),
      createIndexDatabase: () => ({
        initialize: () => {
          throw new Error("Could not locate the bindings file.");
        },
        upsert: () => {
          throw new Error("unexpected upsert call");
        },
        list: () => {
          throw new Error("unexpected list call");
        },
        delete: () => {
          throw new Error("unexpected delete call");
        },
        exists: () => {
          throw new Error("unexpected exists call");
        },
      }),
    });

    persistence.saveWorkflowRecord(workflowRecordJson);

    expect(persistence.workflowExists("wf-desktop")).toBe(true);
    const summaries = persistence.listWorkflowSummaries();
    expect(summaries).toHaveLength(1);
    expect(JSON.parse(summaries[0] ?? "{}").id).toBe("wf-desktop");

    const status = persistence.getWorkflowPersistenceStatus();
    expect(status.degraded).toBe(true);
    expect(status.detail).toContain("SQLite index unavailable");

    persistence.deleteWorkflowRecord("wf-desktop");
    expect(persistence.workflowExists("wf-desktop")).toBe(false);
  });
});
