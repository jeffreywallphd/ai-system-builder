import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "@application/contracts/IdentityLifecycleEventContracts";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteIdentityLifecycleEventPublisher } from "../SqliteIdentityLifecycleEventPublisher";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteIdentityLifecycleEventPublisher", () => {
  it("persists trusted-device lifecycle events with actor and target identifiers", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-identity-audit-publisher-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");
    const publisher = new SqliteIdentityLifecycleEventPublisher(databasePath);

    await publisher.publish(createIdentityLifecycleEvent({
      eventType: IdentityLifecycleEventTypes.trustedDevicePairingInitiated,
      contractVersion: IdentityLifecycleEventContractVersions.v1,
      occurredAt: "2026-04-04T12:00:00.000Z",
      payload: {
        pairingSessionId: "pairing-session:1",
        pairingTokenId: "pairing-token:1",
        trustedDeviceId: "trusted-device:1",
        userIdentityId: "user:1",
        actorScope: "same-user",
        artifactType: "one-time-code",
        issuedAt: "2026-04-04T12:00:00.000Z",
        expiresAt: "2026-04-04T12:30:00.000Z",
        issuedByUserIdentityId: "user:1",
      },
    }));

    const events = publisher.listRecent(10);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe(IdentityLifecycleEventTypes.trustedDevicePairingInitiated);

    publisher.dispose();

    const db = openSqliteCompatDatabase(databasePath);
    const row = db.prepare(`
      SELECT user_identity_id, trusted_device_id, session_id
      FROM identity_lifecycle_audit_events
      LIMIT 1
    `).get() as {
      user_identity_id?: string;
      trusted_device_id?: string;
      session_id?: string | null;
    };
    expect(row.user_identity_id).toBe("user:1");
    expect(row.trusted_device_id).toBe("trusted-device:1");
    expect(row.session_id ?? null).toBeNull();
    db.close();
  });
});

