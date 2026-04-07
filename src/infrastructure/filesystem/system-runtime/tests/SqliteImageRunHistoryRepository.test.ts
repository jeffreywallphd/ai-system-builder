import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { ImageRunHistoryExecutionStatuses } from "@application/system-runtime/ImageRunHistoryDataContract";
import { SqliteImageRunHistoryRepository } from "../SqliteImageRunHistoryRepository";

describe("SqliteImageRunHistoryRepository", () => {
  it("persists and lists image run history records", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "ai-loom-image-run-history-"));
    try {
      const repository = new SqliteImageRunHistoryRepository(path.join(tempDir, "run-history.db"));

      repository.save({
        runId: "run:1",
        workflowExecutionId: "exec:1",
        system: { systemId: "system:image" },
        workflow: { workflowAssetId: "asset:workflow:image", workflowAssetVersionId: "v1" },
        inputs: {
          parameterSummary: { prompt: "cinematic" },
          images: [{ stableId: "input:1" }],
        },
        outputs: {
          datasetInstance: {
            instanceId: "instance:out",
            datasetAssetId: "asset:dataset:out",
            role: "output-store",
            persistedRecordIds: ["record:1"],
          },
          images: [{ outputId: "output:1", recordId: "record:1" }],
        },
        status: ImageRunHistoryExecutionStatuses.completed,
        timestamps: {
          requestedAt: "2026-04-02T00:00:00.000Z",
          startedAt: "2026-04-02T00:00:10.000Z",
          completedAt: "2026-04-02T00:00:20.000Z",
          updatedAt: "2026-04-02T00:00:20.000Z",
        },
      });

      const found = repository.getBySystemAndRunId({ systemId: "system:image", runId: "run:1" });
      expect(found?.workflow.workflowAssetId).toBe("asset:workflow:image");

      const listing = repository.list({
        systemId: "system:image",
        limit: 10,
        offset: 0,
      });
      expect(listing.totalCount).toBe(1);
      expect(listing.records[0]?.runId).toBe("run:1");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

