import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DeploymentPolicyAdministrationContractVersions,
  DeploymentPolicyResolutionSources,
  createDeploymentPolicyValidationOutcome,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  createDeploymentPolicyPersistenceScope,
  DeploymentPolicyPersistenceScopeKinds,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteDeploymentPolicyPersistenceAdapter } from "../SqliteDeploymentPolicyPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createScope() {
  return createDeploymentPolicyPersistenceScope({
    kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
    scopeId: "platform:default",
  });
}

describe("SqliteDeploymentPolicyPersistenceAdapter", () => {
  it("applies schema migrations and creates deployment policy persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-deployment-policy-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "deployment-policy.sqlite");
    const adapter = new SqliteDeploymentPolicyPersistenceAdapter(databasePath);

    await adapter.getActiveProfileSelection(createScope());
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM deployment_policy_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'deployment_policy_active_profile_selection',
          'deployment_policy_overrides',
          'deployment_policy_override_history',
          'deployment_policy_effective_metadata',
          'deployment_policy_mutation_replays'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual([
      "deployment_policy_active_profile_selection",
      "deployment_policy_effective_metadata",
      "deployment_policy_mutation_replays",
      "deployment_policy_override_history",
      "deployment_policy_overrides",
    ]);
    database.close();
  });

  it("durably persists active profile selection, overrides, history, and effective metadata with replay safety", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-deployment-policy-roundtrip-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "deployment-policy.sqlite");
    const adapter = new SqliteDeploymentPolicyPersistenceAdapter(databasePath);
    const scope = createScope();

    const activeSelection = await adapter.setActiveProfileSelection({
      mutation: {
        operationKey: "op:deployment-policy:active-profile:set",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:00:00.000Z",
          reason: "Switch profile baseline for organization launch.",
          ticketReference: "chg-123",
        },
      },
      record: {
        scope,
        profileId: "organization",
        changedAt: "2026-04-07T21:00:00.000Z",
        changedByUserIdentityId: "user:admin",
        reason: "Switch profile baseline for organization launch.",
        ticketReference: "chg-123",
        createdAt: "2026-04-07T21:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-07T21:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 1,
      },
    });
    expect(activeSelection.changed).toBeTrue();
    expect(activeSelection.wasReplay).toBeFalse();
    expect(activeSelection.record.revision).toBe(1);

    const activeReplay = await adapter.setActiveProfileSelection({
      mutation: {
        operationKey: "op:deployment-policy:active-profile:set",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:00:01.000Z",
        },
      },
      record: activeSelection.record,
    });
    expect(activeReplay.changed).toBeFalse();
    expect(activeReplay.wasReplay).toBeTrue();

    const persistedSelection = await adapter.getActiveProfileSelection(scope);
    expect(persistedSelection?.profileId).toBe("organization");
    expect(persistedSelection?.changedByUserIdentityId).toBe("user:admin");

    const createdOverride = await adapter.upsertOverrideRecord({
      mutation: {
        operationKey: "op:deployment-policy:override:upsert:1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:01:00.000Z",
          reason: "Tighten sharing visibility default.",
          ticketReference: "chg-124",
        },
      },
      record: {
        scope,
        profileId: "organization",
        familyId: "sharing-posture",
        settingKey: "defaultWorkspaceVisibility",
        valueType: "string",
        value: "workspace",
        provenance: {
          actorUserIdentityId: "user:admin",
          ticketReference: "chg-124",
          reason: "Tighten sharing visibility default.",
          updatedAt: "2026-04-07T21:01:00.000Z",
        },
        createdAt: "2026-04-07T21:01:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-07T21:01:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 1,
      },
    });
    expect(createdOverride.record.revision).toBe(1);

    const updatedOverride = await adapter.upsertOverrideRecord({
      mutation: {
        operationKey: "op:deployment-policy:override:upsert:2",
        expectedRevision: createdOverride.record.revision,
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:02:00.000Z",
          reason: "Restrict workspace visibility.",
          ticketReference: "chg-125",
        },
      },
      record: {
        ...createdOverride.record,
        value: "private",
        valueType: "string",
      },
    });
    expect(updatedOverride.record.revision).toBe(2);
    expect(updatedOverride.record.value).toBe("private");

    const overrideReplay = await adapter.upsertOverrideRecord({
      mutation: {
        operationKey: "op:deployment-policy:override:upsert:2",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:02:01.000Z",
        },
      },
      record: {
        ...updatedOverride.record,
      },
    });
    expect(overrideReplay.wasReplay).toBeTrue();
    expect(overrideReplay.changed).toBeFalse();

    const overrides = await adapter.listOverrideRecords({
      scope,
      profileId: "organization",
    });
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.familyId).toBe("sharing-posture");
    expect(overrides[0]?.settingKey).toBe("defaultWorkspaceVisibility");
    expect(overrides[0]?.value).toBe("private");

    const removed = await adapter.removeOverrideRecord({
      scope,
      profileId: "organization",
      familyId: "sharing-posture",
      settingKey: "defaultWorkspaceVisibility",
      mutation: {
        operationKey: "op:deployment-policy:override:remove:1",
        expectedRevision: updatedOverride.record.revision,
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:03:00.000Z",
          reason: "Rollback to profile preset.",
          ticketReference: "chg-126",
        },
      },
    });
    expect(removed.record.operation).toBe("remove");

    const removedReplay = await adapter.removeOverrideRecord({
      scope,
      profileId: "organization",
      familyId: "sharing-posture",
      settingKey: "defaultWorkspaceVisibility",
      mutation: {
        operationKey: "op:deployment-policy:override:remove:1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-07T21:03:01.000Z",
        },
      },
    });
    expect(removedReplay.wasReplay).toBeTrue();
    expect(removedReplay.changed).toBeFalse();

    const overridesAfterRemoval = await adapter.listOverrideRecords({
      scope,
      profileId: "organization",
    });
    expect(overridesAfterRemoval).toHaveLength(0);

    const history = await adapter.listOverrideHistory({
      scope,
      profileId: "organization",
      familyId: "sharing-posture",
      settingKey: "defaultWorkspaceVisibility",
    });
    expect(history).toHaveLength(3);
    expect(history[0]?.operation).toBe("remove");
    expect(history[1]?.operation).toBe("upsert");
    expect(history[2]?.operation).toBe("upsert");
    expect(history[1]?.value).toBe("private");

    const savedEffective = await adapter.saveEffectivePolicyMetadata({
      mutation: {
        operationKey: "op:deployment-policy:effective-metadata:save:1",
        context: {
          actorUserIdentityId: "system:policy-evaluator",
          occurredAt: "2026-04-07T21:05:00.000Z",
        },
      },
      record: {
        scope,
        profileId: "organization",
        evaluatedAt: "2026-04-07T21:04:59.000Z",
        evaluationLayer: "application",
        contractVersion: DeploymentPolicyAdministrationContractVersions.v1,
        familyCount: 6,
        settingCount: 18,
        sourceCounts: {
          [DeploymentPolicyResolutionSources.profilePreset]: 16,
          [DeploymentPolicyResolutionSources.policyDefault]: 2,
          [DeploymentPolicyResolutionSources.adminState]: 0,
        },
        validation: createDeploymentPolicyValidationOutcome({
          evaluatedAt: "2026-04-07T21:04:59.000Z",
        }),
        recordedAt: "2026-04-07T21:05:00.000Z",
        recordedByUserIdentityId: "system:policy-evaluator",
        revision: 1,
      },
    });
    expect(savedEffective.record.revision).toBe(1);

    const effectiveReplay = await adapter.saveEffectivePolicyMetadata({
      mutation: {
        operationKey: "op:deployment-policy:effective-metadata:save:1",
        context: {
          actorUserIdentityId: "system:policy-evaluator",
          occurredAt: "2026-04-07T21:05:01.000Z",
        },
      },
      record: savedEffective.record,
    });
    expect(effectiveReplay.wasReplay).toBeTrue();

    const effective = await adapter.getEffectivePolicyMetadata(scope);
    expect(effective?.profileId).toBe("organization");
    expect(effective?.settingCount).toBe(18);
    expect(effective?.validation.valid).toBeTrue();

    adapter.dispose();
  });
});

