import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createExecutionNodeRecord,
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  ExecutionNodeOperationalAvailabilityModes,
  ExecutionNodeTargetKinds,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteExecutionNodeRepository } from "../SqliteExecutionNodeRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createSampleNode(nodeId = "node:execution:1") {
  return createExecutionNodeRecord({
    nodeId,
    displayName: `Execution Node ${nodeId}`,
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.storageAccess],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities: [{
      backendFamily: "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      supportedOperationKinds: ["image-to-image"],
    }],
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    activationStatus: ExecutionNodeActivationStatuses.active,
    healthStatus: ExecutionNodeHealthStatuses.ready,
    deploymentTags: ["region-east", "gpu"],
    endpoint: {
      endpointRef: `node://${nodeId}`,
      configurationRef: `config://${nodeId}`,
    },
    certificateRef: `cert:${nodeId}:v1`,
    lastSeenAt: "2026-04-08T14:00:00.000Z",
    metadata: {
      owner: "platform",
    },
    createdAt: "2026-04-08T14:00:00.000Z",
    updatedAt: "2026-04-08T14:00:00.000Z",
  });
}

describe("SqliteExecutionNodeRepository", () => {
  it("applies migrations and creates execution-node persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-execution-node-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "execution-node.sqlite");

    const repository = new SqliteExecutionNodeRepository(databasePath);
    await repository.registerExecutionNode({
      record: createSampleNode("node:execution:schema"),
      mutation: {
        operationKey: "op:execution-node:schema:register",
        actorId: "system:bootstrap",
      },
    });
    repository.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM execution_node_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(2);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'execution_node_records',
          'execution_node_capabilities_lookup',
          'execution_node_deployment_tags_lookup',
          'execution_node_backend_families_lookup',
          'execution_node_execution_targets_lookup',
          'execution_node_mutation_replays',
          'execution_node_status_history'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "execution_node_backend_families_lookup",
      "execution_node_capabilities_lookup",
      "execution_node_deployment_tags_lookup",
      "execution_node_execution_targets_lookup",
      "execution_node_mutation_replays",
      "execution_node_records",
      "execution_node_status_history",
    ]);

    const columns = database.prepare("PRAGMA table_info('execution_node_records')")
      .all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));
    expect(columnNames.has("availability_override_mode")).toBeTrue();
    expect(columnNames.has("availability_override_suppressed_until")).toBeTrue();
    expect(columnNames.has("availability_override_reason")).toBeTrue();
    expect(columnNames.has("availability_override_updated_at")).toBeTrue();

    database.close();
  });

  it("supports register/read/list and replay-safe operation semantics", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-execution-node-crud-"));
    createdRoots.push(root);
    const repository = new SqliteExecutionNodeRepository(path.join(root, "execution-node.sqlite"));

    const record = createSampleNode("node:execution:crud");
    const created = await repository.registerExecutionNode({
      record,
      mutation: {
        operationKey: "op:execution-node:crud:register",
        actorId: "admin:operator",
        expectedRevision: 0,
      },
    });

    expect(created.changed).toBeTrue();
    expect(created.wasReplay).toBeFalse();

    const replay = await repository.registerExecutionNode({
      record,
      mutation: {
        operationKey: "op:execution-node:crud:register",
        actorId: "admin:operator",
      },
    });
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();

    const found = await repository.findExecutionNodeById("node:execution:crud");
    expect(found?.nodeId).toBe("node:execution:crud");

    const filtered = await repository.listExecutionNodes({
      backendFamilies: ["comfyui"],
      executionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      activationStatuses: [ExecutionNodeActivationStatuses.active],
      healthStatuses: [ExecutionNodeHealthStatuses.ready],
      requiredCapabilitiesAnyOf: [NodeRoleCapabilities.executor],
      deploymentTagAnyOf: ["GPU"],
      supportsRemoteScheduling: true,
      requireCertificateRef: true,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.nodeId).toBe("node:execution:crud");

    await expect(repository.saveExecutionNode({
      record,
      mutation: {
        operationKey: "op:execution-node:crud:stale-save",
        actorId: "admin:operator",
        expectedRevision: 0,
      },
    })).rejects.toThrow("expectedRevision");

    repository.dispose();
  });

  it("records status/capability history for operational updates", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-execution-node-history-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "execution-node.sqlite");
    const repository = new SqliteExecutionNodeRepository(databasePath);

    await repository.registerExecutionNode({
      record: createSampleNode("node:execution:history"),
      mutation: {
        operationKey: "op:execution-node:history:register",
        actorId: "admin:operator",
      },
    });

    await repository.updateExecutionNodeHealth({
      nodeId: "node:execution:history",
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      observedAt: "2026-04-08T14:05:00.000Z",
      mutation: {
        operationKey: "op:execution-node:history:health",
        actorId: "system:health-probe",
      },
    });

    await repository.updateExecutionNodeCapabilities({
      nodeId: "node:execution:history",
      backendFamilyCapabilities: [{
        backendFamily: "comfyui",
        supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
        supportedOperationKinds: ["image-to-image", "text-to-image"],
        executionReadiness: {
          state: "degraded",
          checkedAt: "2026-04-08T14:06:00.000Z",
          summary: "capacity-throttled",
        },
      }],
      refreshedAt: "2026-04-08T14:06:00.000Z",
      mutation: {
        operationKey: "op:execution-node:history:capability",
        actorId: "system:capability-probe",
      },
    });

    await repository.updateExecutionNodeAvailability({
      nodeId: "node:execution:history",
      activationStatus: ExecutionNodeActivationStatuses.degraded,
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      changedAt: "2026-04-08T14:07:00.000Z",
      mutation: {
        operationKey: "op:execution-node:history:availability",
        actorId: "admin:operator",
      },
      details: {
        reasonCode: "maintenance-window",
      },
    });

    repository.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const historyRows = database.prepare(`
      SELECT history_kind, activation_status, health_status, availability_summary, operation_key, details_json
      FROM execution_node_status_history
      WHERE node_id = ?
      ORDER BY changed_at ASC, history_entry_id ASC
    `).all("node:execution:history") as Array<{
      history_kind: string;
      activation_status: string;
      health_status: string;
      availability_summary: string;
      operation_key: string;
      details_json: string | null;
    }>;

    expect(historyRows).toHaveLength(4);
    expect(historyRows.map((row) => row.history_kind)).toEqual([
      "registration",
      "health-refresh",
      "capability-refresh",
      "availability-change",
    ]);

    const availabilityEntry = historyRows[3];
    expect(availabilityEntry?.activation_status).toBe("degraded");
    expect(availabilityEntry?.health_status).toBe("degraded");
    expect(availabilityEntry?.availability_summary).toBe("degraded");
    expect(availabilityEntry?.operation_key).toBe("op:execution-node:history:availability");
    expect(availabilityEntry?.details_json).toContain("maintenance-window");

    database.close();
  });

  it("persists durable operational availability overrides separately from probe health", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-execution-node-override-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "execution-node.sqlite");
    const repository = new SqliteExecutionNodeRepository(databasePath);

    await repository.registerExecutionNode({
      record: createSampleNode("node:execution:override"),
      mutation: {
        operationKey: "op:execution-node:override:register",
        actorId: "admin:operator",
      },
    });

    await repository.updateExecutionNodeOperationalAvailability({
      nodeId: "node:execution:override",
      mode: ExecutionNodeOperationalAvailabilityModes.suppressed,
      suppressedUntil: "2026-04-08T16:00:00.000Z",
      changedAt: "2026-04-08T15:00:00.000Z",
      mutation: {
        operationKey: "op:execution-node:override:suppress",
        actorId: "admin:operator",
        reason: "temporary maintenance hold",
      },
      details: {
        reasonCode: "maintenance-hold",
      },
    });

    await repository.updateExecutionNodeHealth({
      nodeId: "node:execution:override",
      healthStatus: ExecutionNodeHealthStatuses.ready,
      observedAt: "2026-04-08T15:05:00.000Z",
      mutation: {
        operationKey: "op:execution-node:override:health",
        actorId: "system:health-probe",
      },
    });

    const persisted = await repository.findExecutionNodeById("node:execution:override");
    expect(persisted?.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);
    expect(persisted?.availabilityOverride.mode).toBe(ExecutionNodeOperationalAvailabilityModes.suppressed);
    expect(persisted?.availabilityOverride.suppressedUntil).toBe("2026-04-08T16:00:00.000Z");

    repository.dispose();
  });
});
