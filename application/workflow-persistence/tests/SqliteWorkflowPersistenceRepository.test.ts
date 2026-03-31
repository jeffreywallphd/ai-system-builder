import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { CreatePersistedWorkflowUseCase } from "../CreatePersistedWorkflowUseCase";
import { DuplicatePersistedWorkflowUseCase } from "../DuplicatePersistedWorkflowUseCase";
import { GetPersistedWorkflowUseCase } from "../GetPersistedWorkflowUseCase";
import { ListPersistedWorkflowsUseCase } from "../ListPersistedWorkflowsUseCase";
import { UpdatePersistedWorkflowUseCase } from "../UpdatePersistedWorkflowUseCase";
import {
  WorkflowDraftInputSourceTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  type WorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { SqliteWorkflowPersistenceRepository } from "../../../infrastructure/filesystem/SqliteWorkflowPersistenceRepository";
import { WorkflowPersistenceStatuses } from "../../../domain/workflow-studio/WorkflowPersistenceDomain";
import { openSqliteCompatDatabase } from "../../../infrastructure/filesystem/sqlite/SqliteCompat";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createValidDraft(): WorkflowDraft {
  return Object.freeze({
    triggers: [Object.freeze({
      id: "trigger-1",
      kind: WorkflowDraftTriggerKinds.user,
      type: WorkflowDraftTriggerTypes.userManual,
      config: Object.freeze({}),
    })],
    inputs: [Object.freeze({
      id: "input-1",
      type: "dataset",
      sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
      asset: Object.freeze({ assetId: "asset:dataset-1", versionId: "asset:dataset-1:v1" }),
    })],
    steps: [Object.freeze({
      id: "step-1",
      type: "action",
      kind: WorkflowDraftStepKinds.action,
      order: 1,
      title: "Prepare",
    })],
    outputs: [Object.freeze({
      id: "output-1",
      type: "workflow-output",
      outputType: WorkflowDraftOutputTypes.document,
      format: WorkflowDraftOutputFormats.json,
      sourceStepId: "step-1",
      destination: Object.freeze({
        type: WorkflowDraftOutputDestinationTypes.webViewer,
        target: "preview",
      }),
    })],
  });
}

describe("SqliteWorkflowPersistenceRepository", () => {
  it("round-trips create/update/get/list/duplicate operations through canonical persisted workflow records", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-persistence-"));
    createdRoots.push(root);
    const repository = new SqliteWorkflowPersistenceRepository(path.join(root, "workflow-persistence.sqlite"));

    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const update = new UpdatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:05:00.000Z"));
    const get = new GetPersistedWorkflowUseCase(repository);
    const list = new ListPersistedWorkflowsUseCase(repository);
    const duplicate = new DuplicatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:10:00.000Z"));

    const created = await create.execute({
      id: "workflow:sqlite:1",
      name: "SQLite Workflow",
      draft: createValidDraft(),
      metadata: { summary: "Initial", tags: ["sqlite", "workflow"] },
      ownershipContext: { ownerId: "user:1", studioId: "studio-workflows", sessionId: "session-1" },
    });
    expect(created.status).toBe(WorkflowPersistenceStatuses.draft);
    expect(created.revision.persistenceRevision).toBe(1);

    const updated = await update.execute({
      id: created.id,
      changes: {
        name: "SQLite Workflow Updated",
        draft: createValidDraft(),
        lifecycleState: "saved",
        versionLabel: "v1",
      },
    });
    expect(updated.status).toBe(WorkflowPersistenceStatuses.saved);
    expect(updated.revision.persistenceRevision).toBe(2);
    expect(updated.timestamps.savedAt).toBe("2026-03-30T10:05:00.000Z");

    const loaded = await get.execute(created.id);
    expect(loaded?.name).toBe("SQLite Workflow Updated");
    expect(loaded?.definition.draft.steps[0]?.id).toBe("step-1");

    const duplicated = await duplicate.execute({
      sourceWorkflowId: created.id,
      duplicatedWorkflowId: "workflow:sqlite:1:copy",
      duplicatedWorkflowName: "SQLite Workflow Copy",
    });
    expect(duplicated.revision.duplicatedFromWorkflowId).toBe(created.id);
    expect(duplicated.status).toBe(WorkflowPersistenceStatuses.draft);

    const listedAll = await list.execute();
    expect(listedAll.map((entry) => entry.id)).toEqual(["workflow:sqlite:1:copy", "workflow:sqlite:1"]);

    const listedSaved = await list.execute({ status: WorkflowPersistenceStatuses.saved });
    expect(listedSaved.map((entry) => entry.id)).toEqual(["workflow:sqlite:1"]);

    const listedSearch = await list.execute({ searchText: "copy" });
    expect(listedSearch.map((entry) => entry.id)).toEqual(["workflow:sqlite:1:copy"]);

    repository.dispose();
  });

  it("fails fast when persisted record JSON is malformed or has invalid canonical workflow entity payload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-persistence-invalid-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-persistence.sqlite");
    const repository = new SqliteWorkflowPersistenceRepository(databasePath);

    await createBaselineRecord(repository);
    repository.dispose();

    const db = openSqliteCompatDatabase(databasePath);
    db.prepare("UPDATE workflow_persistence_records SET record_json = ? WHERE workflow_id = ?")
      .run("{ bad-json", "workflow:sqlite:malformed");
    db.close();

    const reopened = new SqliteWorkflowPersistenceRepository(databasePath);
    await expect(reopened.getById("workflow:sqlite:malformed")).rejects.toThrow();
    reopened.dispose();
  });
});

async function createBaselineRecord(repository: SqliteWorkflowPersistenceRepository): Promise<void> {
  const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
  await create.execute({
    id: "workflow:sqlite:malformed",
    name: "Malformed",
    draft: createValidDraft(),
    metadata: { tags: ["malformed"] },
  });
}
