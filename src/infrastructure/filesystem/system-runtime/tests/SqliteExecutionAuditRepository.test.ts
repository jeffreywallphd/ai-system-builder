import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteExecutionAuditRepository } from "../SqliteExecutionAuditRepository";
import { ExecutionAuditEventKinds } from "../../../../domain/system-runtime/ExecutionAuditTrailDomain";

describe("SqliteExecutionAuditRepository", () => {
  it("persists and lists audit records by execution id and recency", () => {
    const baseDir = mkdtempSync(path.join(tmpdir(), "audit-repo-"));
    try {
      const repository = new SqliteExecutionAuditRepository(path.join(baseDir, "audit.sqlite"));
      repository.save(Object.freeze({
        auditId: "audit-1",
        occurredAt: "2026-03-28T00:00:00.000Z",
        eventKind: ExecutionAuditEventKinds.requested,
        requestSource: "external-api",
        caller: Object.freeze({ callerId: "user-1" }),
        tenant: Object.freeze({ tenantId: "tenant-a" }),
        execution: Object.freeze({ executionId: "exec-1", systemId: "system:one", versionId: "system:one:v1" }),
      }));
      repository.save(Object.freeze({
        auditId: "audit-2",
        occurredAt: "2026-03-28T00:00:02.000Z",
        eventKind: ExecutionAuditEventKinds.completed,
        requestSource: "external-api",
        caller: Object.freeze({ callerId: "user-1" }),
        tenant: Object.freeze({ tenantId: "tenant-a" }),
        execution: Object.freeze({ executionId: "exec-1", systemId: "system:one", versionId: "system:one:v1" }),
      }));

      const byExecution = repository.listByExecutionId("exec-1");
      expect(byExecution.map((entry) => entry.auditId)).toEqual(["audit-1", "audit-2"]);

      const recent = repository.listRecent(1);
      expect(recent).toHaveLength(1);
      expect(recent[0]?.auditId).toBe("audit-2");
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
