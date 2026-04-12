import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteNodeTrustAuditRecorder } from "../SqliteNodeTrustAuditRecorder";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteNodeTrustAuditRecorder", () => {
  it("persists and retrieves node trust audit events", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-trust-audit-"));
    createdRoots.push(root);
    const recorder = new SqliteNodeTrustAuditRecorder(path.join(root, "node-trust.sqlite"));

    await recorder.recordNodeTrustAuditEvent({
      type: "node-enrollment-requested",
      actorUserIdentityId: "node:bootstrap:1",
      occurredAt: "2026-04-05T18:00:00.000Z",
      nodeId: "node:compute:1",
      enrollmentRequestId: "enrollment:1",
      outcome: "success",
      details: Object.freeze({
        status: "submitted",
      }),
    });

    const events = recorder.listRecent(10);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("node-enrollment-requested");
    expect(events[0]?.actorUserIdentityId).toBe("node:bootstrap:1");
    expect(events[0]?.outcome).toBe("success");
    expect((events[0]?.details as Record<string, unknown>)?.status).toBe("submitted");

    recorder.dispose();
  });
});
