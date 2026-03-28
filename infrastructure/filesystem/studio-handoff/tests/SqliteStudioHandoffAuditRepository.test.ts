import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { SqliteStudioHandoffAuditRepository } from "../SqliteStudioHandoffAuditRepository";
import { StudioHandoffAuditTrailService } from "../../../../application/studio-handoff/StudioHandoffAuditTrailService";
import { StudioHandoffAuditEventKinds, StudioHandoffAuditOutcomes } from "../../../../domain/studio-handoff/StudioHandoffAuditTrail";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createRepository(): SqliteStudioHandoffAuditRepository {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-handoff-audit-sqlite-"));
  tempDirs.push(dir);
  return new SqliteStudioHandoffAuditRepository(path.join(dir, "handoff-audit.db"));
}

describe("SqliteStudioHandoffAuditRepository", () => {
  it("persists and queries durable handoff audit records by handoff id and recency", () => {
    const repository = createRepository();
    const trail = new StudioHandoffAuditTrailService(repository);

    trail.record({
      eventKind: StudioHandoffAuditEventKinds.handoffCreated,
      outcome: StudioHandoffAuditOutcomes.accepted,
      handoff: { handoffId: "handoff:a" },
      sourceStudio: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
      targetStudio: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
      assets: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", role: "primary" }],
      detail: { statusCode: "created" },
      occurredAt: "2026-03-28T00:00:01.000Z",
    });

    trail.record({
      eventKind: StudioHandoffAuditEventKinds.handoffOrchestrated,
      outcome: StudioHandoffAuditOutcomes.succeeded,
      handoff: { handoffId: "handoff:a" },
      sourceStudio: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
      targetStudio: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
      assets: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", role: "primary" }],
      detail: { statusCode: "prepared" },
      occurredAt: "2026-03-28T00:00:02.000Z",
    });

    trail.record({
      eventKind: StudioHandoffAuditEventKinds.handoffFailed,
      outcome: StudioHandoffAuditOutcomes.failed,
      handoff: { handoffId: "handoff:b" },
      sourceStudio: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
      targetStudio: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
      assets: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2", role: "primary" }],
      detail: { statusCode: "input-adaptation-failed", compatibilityPassed: false },
      occurredAt: "2026-03-28T00:00:03.000Z",
    });

    const byHandoffA = trail.listByHandoffId("handoff:a", 20);
    expect(byHandoffA).toHaveLength(2);
    expect(byHandoffA[0]?.eventKind).toBe(StudioHandoffAuditEventKinds.handoffOrchestrated);

    const recent = trail.listRecent(20);
    expect(recent[0]?.handoff.handoffId).toBe("handoff:b");
    expect(recent[1]?.handoff.handoffId).toBe("handoff:a");
  });
});
