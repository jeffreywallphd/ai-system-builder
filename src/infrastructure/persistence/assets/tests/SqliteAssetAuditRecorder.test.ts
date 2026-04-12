import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteAssetAuditRecorder } from "../SqliteAssetAuditRecorder";

describe("SqliteAssetAuditRecorder", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (!directory) {
        continue;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists and queries asset audit events", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ai-loom-asset-audit-recorder-test-"));
    tempDirectories.push(directory);
    const databasePath = join(directory, "asset-audit.sqlite");
    const recorder = new SqliteAssetAuditRecorder(databasePath);

    await recorder.recordAssetEvent({
      type: "asset-download-opened",
      occurredAt: "2026-04-06T12:00:00.000Z",
      workspaceId: "workspace-audit",
      actorUserId: "user-audit",
      correlationId: "corr-1",
      operationKey: "asset:download:open:1",
      outcome: "success",
      asset: {
        assetId: "asset-audit-1",
        kind: "generated-output",
        visibility: "workspace",
        lifecycleState: "active",
        versionId: "asset-audit-1:v1",
      },
      details: {
        purpose: "download",
      },
    });

    const recent = recorder.listRecent(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.type).toBe("asset-download-opened");

    const byWorkspace = recorder.listByWorkspaceId("workspace-audit", 10);
    expect(byWorkspace).toHaveLength(1);
    expect(byWorkspace[0]?.workspaceId).toBe("workspace-audit");

    const byAsset = recorder.listByAssetId("asset-audit-1", 10);
    expect(byAsset).toHaveLength(1);
    expect(byAsset[0]?.asset.assetId).toBe("asset-audit-1");

    recorder.dispose();
  });
});
