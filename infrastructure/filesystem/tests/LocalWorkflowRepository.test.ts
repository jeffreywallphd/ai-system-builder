import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Workflow } from "../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../domain/workflows/tests/testUtils";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalWorkflowRepository } from "../LocalWorkflowRepository";

describe("LocalWorkflowRepository", () => {
  it("saves, loads, exists and lists workflows", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-workflows-"));
    try {
      const node = makeNode({ id: "n1" });
      const wf = new Workflow({ id: "wf-1", metadata: new WorkflowMetadata({ name: "WF" }), nodes: [node] });
      const repo = new LocalWorkflowRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
        nodeCatalogProvider: {
          getAllDefinitions: async () => [node.definition],
          searchDefinitions: async () => [node.definition],
          getDefinitionById: async () => node.definition,
          getDefinitionByType: async () => node.definition,
          getCategories: async () => ["utility"],
        },
      });

      await repo.save(wf);
      expect(await repo.exists("wf-1")).toBe(true);
      expect((await repo.load("wf-1"))?.id).toBe("wf-1");
      expect((await repo.list()).length).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
