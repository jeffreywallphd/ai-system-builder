import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteWorkflowOutputProvenanceRepository } from "../SqliteWorkflowOutputProvenanceRepository";

describe("SqliteWorkflowOutputProvenanceRepository", () => {
  it("persists and queries workflow output provenance by run and output asset", () => {
    const baseDir = mkdtempSync(path.join(tmpdir(), "output-provenance-"));
    try {
      const repository = new SqliteWorkflowOutputProvenanceRepository(path.join(baseDir, "provenance.sqlite"));
      repository.save(Object.freeze({
        provenanceId: "prov-1",
        createdAt: "2026-04-01T11:00:00.000Z",
        updatedAt: "2026-04-01T11:00:00.000Z",
        status: "materialized",
        systemId: "system:image",
        datasetInstanceId: "instance:outputs",
        materializationId: "mat:1",
        workflowRunId: "run:1",
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v3",
        outputRecordId: "record:1",
        outputAssetStableId: "generated-output:asset:1",
        outputRole: "primary",
        outputIndex: 0,
        outputGroupId: "group:1",
        sourceImageStableIds: Object.freeze(["generated-output:source:1"]),
        parameterSnapshot: Object.freeze({ prompt: "a" }),
        executionContext: Object.freeze({ seed: 10 }),
        capabilityContext: Object.freeze({ supportsCancellation: true }),
      }));
      repository.save(Object.freeze({
        provenanceId: "prov-2",
        createdAt: "2026-04-01T11:00:01.000Z",
        updatedAt: "2026-04-01T11:00:01.000Z",
        status: "materialized",
        systemId: "system:image",
        datasetInstanceId: "instance:outputs",
        materializationId: "mat:1",
        workflowRunId: "run:1",
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v3",
        outputRecordId: "record:2",
        outputAssetStableId: "generated-output:asset:2",
        outputRole: "variant",
        outputIndex: 1,
        outputGroupId: "group:1",
        sourceImageStableIds: Object.freeze(["generated-output:source:1"]),
        parameterSnapshot: Object.freeze({ prompt: "b" }),
        executionContext: Object.freeze({ seed: 11 }),
        capabilityContext: Object.freeze({ supportsCancellation: false }),
      }));

      const byRun = repository.listByWorkflowRunId("run:1");
      expect(byRun).toHaveLength(2);
      expect(byRun[0]?.outputRecordId).toBe("record:1");

      const byAsset = repository.listByOutputAssetStableId("generated-output:asset:2");
      expect(byAsset).toHaveLength(1);
      expect(byAsset[0]?.parameterSnapshot.prompt).toBe("b");

      const filtered = repository.query({ systemId: "system:image", datasetInstanceId: "instance:outputs", limit: 1 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.provenanceId).toBe("prov-2");

      const byGroup = repository.query({ workflowRunId: "run:1", outputGroupId: "group:1" });
      expect(byGroup).toHaveLength(2);
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
