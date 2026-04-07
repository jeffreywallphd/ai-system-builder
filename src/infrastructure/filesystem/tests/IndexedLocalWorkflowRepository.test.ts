import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Workflow } from "../../../src/domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../src/domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../src/domain/workflows/tests/testUtils";
import { LocalFileStorage } from "../LocalFileStorage";
import { IndexedLocalWorkflowRepository } from "../IndexedLocalWorkflowRepository";
import { SqliteWorkflowIndexDatabase } from "../SqliteWorkflowIndexDatabase";

function createNodeCatalog(node = makeNode({ id: "n1" })) {
  return {
    getAllDefinitions: async () => [node.definition],
    searchDefinitions: async () => [node.definition],
    getDefinitionById: async () => node.definition,
    getDefinitionByType: async () => node.definition,
    getCategories: async () => ["utility"],
  };
}

describe("IndexedLocalWorkflowRepository", () => {
  it("persists canonical workflow JSON and rebuilds list/exists from the SQLite index", async () => {
    const sqlite = new SqliteWorkflowIndexDatabase(path.join(tmpdir(), "loom-workflow-indexed-probe.sqlite"));
    if (!sqlite.isAvailable) {
      return;
    }

    const root = await mkdtemp(path.join(tmpdir(), "loom-workflow-indexed-"));
    const workflowsRoot = path.join(root, "workflows");
    const indexDatabasePath = path.join(root, "workflows", "workflow-index.sqlite");
    const node = makeNode({ id: "n1" });
    const workflow = new Workflow({
      id: "wf-indexed",
      metadata: new WorkflowMetadata({ name: "Indexed workflow" }),
      nodes: [node],
    });

    try {
      const repository = new IndexedLocalWorkflowRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: workflowsRoot,
        indexDatabasePath,
        nodeCatalogProvider: createNodeCatalog(node),
      });

      await repository.save(workflow);
      expect(existsSync(path.join(workflowsRoot, "wf-indexed.json"))).toBe(true);
      expect(existsSync(indexDatabasePath)).toBe(true);
      expect(await repository.exists("wf-indexed")).toBe(true);
      expect((await repository.list()).map((summary) => summary.id)).toEqual(["wf-indexed"]);

      const reopened = new IndexedLocalWorkflowRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: workflowsRoot,
        indexDatabasePath,
        nodeCatalogProvider: createNodeCatalog(node),
      });

      expect((await reopened.list()).map((summary) => summary.id)).toEqual(["wf-indexed"]);
      expect((await reopened.load("wf-indexed"))?.metadata.name).toBe("Indexed workflow");

      await reopened.delete("wf-indexed");
      expect(await reopened.exists("wf-indexed")).toBe(false);
      expect(await reopened.list()).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
