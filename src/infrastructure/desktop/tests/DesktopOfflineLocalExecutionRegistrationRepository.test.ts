import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  OfflineLocalExecutionRegistrationRetryBackoffPolicies,
  OfflineLocalExecutionRegistrationService,
} from "@application/common/OfflineLocalExecutionRegistrationPersistence";
import {
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineNodeOperationalModes,
  OfflineResourceClasses,
  OfflineWorkstationModes,
  createOfflineLocalExecutionRecord,
  createOfflineLocalExecutionRegistrationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { DesktopOfflineLocalExecutionRegistrationRepository } from "../DesktopOfflineLocalExecutionRegistrationRepository";
import {
  DesktopOfflineValueProtectionPostures,
  type DesktopOfflineValueProtectionPort,
} from "../DesktopOfflineValueProtection";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function createRegistration(registrationId: string, executionId: string, queuedAt: string) {
  const execution = createOfflineLocalExecutionRecord({
    executionId,
    executionClass: OfflineLocalExecutionClasses.localWorkflowValidation,
    resourceClass: OfflineResourceClasses.localRuntimeSession,
    resourceId: `runtime:session:${executionId}`,
    startedAt: "2026-04-08T12:00:00.000Z",
    completedAt: "2026-04-08T12:00:10.000Z",
    executedByActorUserIdentityId: "user:persist",
    nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
    workstationMode: OfflineWorkstationModes.interactiveUserSession,
    outcome: OfflineLocalExecutionOutcomes.succeeded,
    inputDigest: `sha256:input:${executionId}`,
    outputs: [{
      outputId: `output:${executionId}`,
      outputClass: OfflineLocalExecutionOutputClasses.metricsSnapshot,
      contentDigest: `sha256:output:${executionId}`,
      sizeBytes: 64,
    }],
  });

  return createOfflineLocalExecutionRegistrationEnvelope({
    registrationId,
    execution,
    queuedAt,
    divergenceDisclosureToken: `offline-warning:${registrationId}`,
    replayDescriptor: {
      method: "POST",
      path: `/v1/offline/local-executions/${executionId}/register`,
      idempotencyKey: `idem:${registrationId}`,
      payload: Object.freeze({ executionId }),
    },
  });
}

describe("DesktopOfflineLocalExecutionRegistrationRepository", () => {
  it("persists local execution registration records across repository restart with metadata intact", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-local-exec-registration-"));
    tempRoots.push(root);
    const databasePath = path.join(root, "offline-local-exec-registration.sqlite");

    const repository = new DesktopOfflineLocalExecutionRegistrationRepository({
      databasePath,
      maxEntries: 100,
    });
    const service = new OfflineLocalExecutionRegistrationService(repository);

    await service.queueRegistration({
      registration: createRegistration("registration:persist:1", "execution:persist:1", "2026-04-08T12:01:00.000Z"),
      actorWorkspaceContext: {
        workspaceId: "workspace:persist",
        actorUserIdentityId: "user:persist",
      },
      retryability: {
        retryable: true,
        retryCount: 1,
        maxRetryCount: 5,
        backoffPolicy: OfflineLocalExecutionRegistrationRetryBackoffPolicies.exponential,
        lastAttemptedAt: "2026-04-08T12:02:00.000Z",
      },
    });

    repository.dispose();

    const reopened = new DesktopOfflineLocalExecutionRegistrationRepository({
      databasePath,
      maxEntries: 100,
    });
    const loaded = await reopened.findRegistration("workspace:persist", "registration:persist:1");

    expect(loaded).toBeDefined();
    expect(loaded?.actorWorkspaceContext.workspaceId).toBe("workspace:persist");
    expect(loaded?.registration.execution.executionId).toBe("execution:persist:1");
    expect(loaded?.registration.execution.outputs[0]?.contentDigest).toBe("sha256:output:execution:persist:1");
    expect(loaded?.canonicalExecutionMetadataJson).toContain("\"executionId\":\"execution:persist:1\"");
    expect(loaded?.retryability.retryCount).toBe(1);
    reopened.dispose();
  });

  it("protects persisted local execution registration payload fields when local protected storage is available", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-local-exec-registration-protection-"));
    tempRoots.push(root);
    const databasePath = path.join(root, "offline-local-exec-registration.sqlite");
    const valueProtection: DesktopOfflineValueProtectionPort = Object.freeze({
      posture: DesktopOfflineValueProtectionPostures.protectedAtRest,
      protect: (value: string) => `enc::${Buffer.from(value, "utf8").toString("base64")}`,
      unprotect: (value: string) => {
        if (!value.startsWith("enc::")) {
          return value;
        }
        return Buffer.from(value.slice("enc::".length), "base64").toString("utf8");
      },
    });

    const repository = new DesktopOfflineLocalExecutionRegistrationRepository({
      databasePath,
      maxEntries: 100,
      valueProtection,
    });
    const service = new OfflineLocalExecutionRegistrationService(repository);

    await service.queueRegistration({
      registration: createRegistration(
        "registration:protected:1",
        "execution:protected:1",
        "2026-04-08T12:01:00.000Z",
      ),
      actorWorkspaceContext: {
        workspaceId: "workspace:protected",
        actorUserIdentityId: "user:protected",
      },
    });

    const db = new Database(databasePath, { readonly: true });
    const row = db.prepare(`
      SELECT registration_envelope_json, canonical_execution_metadata_json, payload_protection_posture
      FROM offline_local_execution_registrations
      WHERE workspace_id = ? AND registration_id = ?
    `).get("workspace:protected", "registration:protected:1") as {
      readonly registration_envelope_json: string;
      readonly canonical_execution_metadata_json: string;
      readonly payload_protection_posture: string;
    };
    db.close();

    expect(row.payload_protection_posture).toBe("protected-at-rest");
    expect(row.registration_envelope_json.startsWith("enc::")).toBeTrue();
    expect(row.canonical_execution_metadata_json.startsWith("enc::")).toBeTrue();
    expect(row.registration_envelope_json).not.toContain("execution:protected:1");

    repository.dispose();
  });

  it("enforces retention bound when local execution registration count exceeds configured max entries", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-local-exec-registration-retention-"));
    tempRoots.push(root);

    const repository = new DesktopOfflineLocalExecutionRegistrationRepository({
      databasePath: path.join(root, "offline-local-exec-registration.sqlite"),
      maxEntries: 2,
    });
    const service = new OfflineLocalExecutionRegistrationService(repository);

    await service.queueRegistration({
      registration: createRegistration("registration:retention:1", "execution:retention:1", "2026-04-08T12:00:01.000Z"),
      actorWorkspaceContext: {
        workspaceId: "workspace:retention",
        actorUserIdentityId: "user:retention",
      },
    });
    await service.queueRegistration({
      registration: createRegistration("registration:retention:2", "execution:retention:2", "2026-04-08T12:00:02.000Z"),
      actorWorkspaceContext: {
        workspaceId: "workspace:retention",
        actorUserIdentityId: "user:retention",
      },
    });
    await service.queueRegistration({
      registration: createRegistration("registration:retention:3", "execution:retention:3", "2026-04-08T12:00:03.000Z"),
      actorWorkspaceContext: {
        workspaceId: "workspace:retention",
        actorUserIdentityId: "user:retention",
      },
    });

    const registrations = await repository.listRegistrationsByWorkspace("workspace:retention");
    expect(registrations.length).toBe(2);
    expect(registrations.map((entry) => entry.registration.registrationId)).toEqual([
      "registration:retention:2",
      "registration:retention:3",
    ]);

    repository.dispose();
  });
});
