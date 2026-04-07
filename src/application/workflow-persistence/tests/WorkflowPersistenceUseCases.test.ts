import { describe, expect, it } from "bun:test";
import {
  createPersistedWorkflowRecord,
  type PersistedWorkflowRecord,
  type PersistedWorkflowSummary,
} from "../../../domain/workflow-studio/WorkflowPersistenceDomain";
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
import type {
  IWorkflowPersistenceRepository,
  WorkflowPersistenceListQuery,
} from "../../ports/interfaces/IWorkflowPersistenceRepository";
import { CreatePersistedWorkflowUseCase } from "../CreatePersistedWorkflowUseCase";
import { UpdatePersistedWorkflowUseCase } from "../UpdatePersistedWorkflowUseCase";
import { GetPersistedWorkflowUseCase } from "../GetPersistedWorkflowUseCase";
import { ListPersistedWorkflowsUseCase } from "../ListPersistedWorkflowsUseCase";
import { DuplicatePersistedWorkflowUseCase } from "../DuplicatePersistedWorkflowUseCase";
import {
  WorkflowPersistenceConflictError,
  WorkflowPersistenceFailureError,
  WorkflowPersistenceInvalidRequestError,
  WorkflowPersistenceNotFoundError,
} from "../WorkflowPersistenceErrors";

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
    })],
    outputs: [Object.freeze({
      id: "output-1",
      type: "workflow-output",
      outputType: WorkflowDraftOutputTypes.document,
      format: WorkflowDraftOutputFormats.json,
      destination: Object.freeze({
        type: WorkflowDraftOutputDestinationTypes.fileExport,
        target: "/tmp/workflow-output.json",
      }),
    })],
  });
}

class InMemoryWorkflowPersistenceRepository implements IWorkflowPersistenceRepository {
  private readonly records = new Map<string, PersistedWorkflowRecord>();

  async create(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    this.records.set(record.id, record);
    return record;
  }

  async update(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    this.records.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<PersistedWorkflowRecord | undefined> {
    return this.records.get(id.trim());
  }

  async list(query?: WorkflowPersistenceListQuery): Promise<ReadonlyArray<PersistedWorkflowSummary>> {
    let entries = [...this.records.values()];
    if (query?.status) {
      entries = entries.filter((entry) => entry.status === query.status);
    }
    if (query?.ownerId) {
      entries = entries.filter((entry) => entry.ownershipContext?.ownerId === query.ownerId);
    }
    if (query?.studioId) {
      entries = entries.filter((entry) => entry.ownershipContext?.studioId === query.studioId);
    }
    if (query?.searchText) {
      const normalized = query.searchText.trim().toLowerCase();
      entries = entries.filter((entry) =>
        entry.name.toLowerCase().includes(normalized)
        || entry.metadata.tags.some((tag) => tag.toLowerCase().includes(normalized)));
    }

    entries.sort((left, right) => right.timestamps.updatedAt.localeCompare(left.timestamps.updatedAt));
    const limited = query?.limit && query.limit > 0 ? entries.slice(0, query.limit) : entries;
    return Object.freeze(limited.map((entry) => ({
      id: entry.id,
      name: entry.name,
      metadata: entry.metadata,
      status: entry.status,
      lifecycleState: entry.lifecycleState,
      ownershipContext: entry.ownershipContext,
      revision: entry.revision,
      timestamps: entry.timestamps,
    })));
  }

  async duplicate(sourceWorkflowId: string, duplicateRecord: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    if (!this.records.has(sourceWorkflowId.trim())) {
      throw new Error(`missing source: ${sourceWorkflowId}`);
    }
    this.records.set(duplicateRecord.id, duplicateRecord);
    return duplicateRecord;
  }
}

describe("Workflow persistence use cases", () => {
  it("creates and saves persisted workflows with canonical metadata, status, timestamps, and revisions", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const now = new Date("2026-03-30T10:00:00.000Z");
    const create = new CreatePersistedWorkflowUseCase(repository, () => now);

    const created = await create.execute({
      id: "workflow:persistence:1",
      name: "Workflow Persistence 1",
      draft: createValidDraft(),
      metadata: { summary: "Workflow summary", tags: ["workflow", "workflow", "draft"] },
      ownershipContext: { ownerId: "user:1", studioId: "studio-workflows" },
      versionLabel: "v0.1",
    });

    expect(created.id).toBe("workflow:persistence:1");
    expect(created.status).toBe("draft");
    expect(created.metadata.tags).toEqual(["workflow", "draft"]);
    expect(created.revision.persistenceRevision).toBe(1);
    expect(created.revision.workflowRevision).toBe(1);
    expect(created.timestamps.createdAt).toBe("2026-03-30T10:00:00.000Z");
    expect(created.timestamps.updatedAt).toBe("2026-03-30T10:00:00.000Z");
    expect(created.payload.schemaVersion).toBe("ai-loom.workflow-entity.v1");
  });

  it("updates persisted workflows and preserves metadata/status/timestamp/revision consistency", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const createdAt = new Date("2026-03-30T10:00:00.000Z");
    const updatedAt = new Date("2026-03-30T10:05:00.000Z");
    const create = new CreatePersistedWorkflowUseCase(repository, () => createdAt);
    const update = new UpdatePersistedWorkflowUseCase(repository, () => updatedAt);

    await create.execute({
      id: "workflow:persistence:update",
      name: "Original",
      draft: createValidDraft(),
      metadata: { tags: ["original"] },
    });

    const updated = await update.execute({
      id: "workflow:persistence:update",
      changes: {
        name: "Renamed",
        metadata: { summary: "Updated summary", tags: ["updated", "workflow"] },
        draft: createValidDraft(),
        lifecycleState: "saved",
        ownershipContext: { ownerId: "user:2", studioId: "studio-workflows" },
        versionLabel: "v1.0",
      },
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.status).toBe("saved");
    expect(updated.revision.persistenceRevision).toBe(2);
    expect(updated.revision.workflowRevision).toBe(2);
    expect(updated.revision.versionLabel).toBe("v1.0");
    expect(updated.timestamps.createdAt).toBe("2026-03-30T10:00:00.000Z");
    expect(updated.timestamps.updatedAt).toBe("2026-03-30T10:05:00.000Z");
    expect(updated.timestamps.savedAt).toBe("2026-03-30T10:05:00.000Z");
    expect(updated.ownershipContext?.ownerId).toBe("user:2");
  });

  it("loads persisted workflows by id and lists persisted workflow summaries with query filters", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const update = new UpdatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:05:00.000Z"));
    const get = new GetPersistedWorkflowUseCase(repository);
    const list = new ListPersistedWorkflowsUseCase(repository);

    await create.execute({
      id: "workflow:persistence:list-1",
      name: "Draft Workflow",
      draft: createValidDraft(),
      metadata: { tags: ["draft"] },
      ownershipContext: { ownerId: "user:1", studioId: "studio-workflows" },
    });
    await create.execute({
      id: "workflow:persistence:list-2",
      name: "Saved Workflow",
      draft: createValidDraft(),
      metadata: { tags: ["saved"] },
      ownershipContext: { ownerId: "user:2", studioId: "studio-workflows" },
    });
    await update.execute({
      id: "workflow:persistence:list-2",
      changes: { lifecycleState: "saved" },
    });

    const loaded = await get.execute("workflow:persistence:list-1");
    expect(loaded?.name).toBe("Draft Workflow");

    const savedOnly = await list.execute({ status: "saved" });
    expect(savedOnly.map((entry) => entry.id)).toEqual(["workflow:persistence:list-2"]);

    const user1Only = await list.execute({ ownerId: "user:1", searchText: "draft" });
    expect(user1Only.map((entry) => entry.id)).toEqual(["workflow:persistence:list-1"]);
  });

  it("duplicates persisted workflows as new draft records with new identity and lineage metadata", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const duplicate = new DuplicatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:10:00.000Z"));

    await create.execute({
      id: "workflow:persistence:source",
      name: "Source Workflow",
      draft: createValidDraft(),
      metadata: { tags: ["source"] },
      versionLabel: "v1",
    });

    const duplicated = await duplicate.execute({
      sourceWorkflowId: "workflow:persistence:source",
      duplicatedWorkflowName: "Source Workflow Copy",
    });

    expect(duplicated.id).toBe("workflow:persistence:source:copy");
    expect(duplicated.name).toBe("Source Workflow Copy");
    expect(duplicated.status).toBe("draft");
    expect(duplicated.revision.versionLabel).toBeUndefined();
    expect(duplicated.revision.duplicatedFromWorkflowId).toBe("workflow:persistence:source");
    expect(duplicated.revision.persistenceRevision).toBe(1);
    expect(duplicated.revision.workflowRevision).toBe(1);
  });

  it("derives canonical workspace ownership metadata during creation and duplication when workspace scope is provided", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const duplicate = new DuplicatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:10:00.000Z"));

    const created = await create.execute({
      id: "workflow:persistence:workspace-owned",
      name: "Workspace Owned Workflow",
      draft: createValidDraft(),
      ownershipContext: {
        ownerId: "user:workspace-owner",
        tenantId: "workspace:alpha",
      },
      workspace: {
        workspaceId: "workspace:alpha",
        visibility: "team",
      },
    });

    expect(created.ownershipContext?.workspaceId).toBe("workspace:alpha");
    expect(created.ownershipContext?.tenantId).toBe("workspace:alpha");
    expect(created.ownershipContext?.workspaceOwnership?.workspaceId).toBe("workspace:alpha");
    expect(created.ownershipContext?.workspaceOwnership?.ownerUserId).toBe("user:workspace-owner");
    expect(created.ownershipContext?.workspaceOwnership?.visibility).toBe("team");

    const duplicated = await duplicate.execute({
      sourceWorkflowId: created.id,
      duplicatedWorkflowId: "workflow:persistence:workspace-owned:copy-explicit",
      actorContext: {
        actorUserId: "user:workspace-owner",
      },
      workspace: {
        workspaceId: "workspace:alpha",
      },
    });

    expect(duplicated.ownershipContext?.workspaceId).toBe("workspace:alpha");
    expect(duplicated.ownershipContext?.workspaceOwnership?.workspaceId).toBe("workspace:alpha");
    expect(duplicated.ownershipContext?.workspaceOwnership?.ownerUserId).toBe("user:workspace-owner");
  });

  it("allocates stable duplicate ids when automatic copy ids are already taken", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const duplicate = new DuplicatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:10:00.000Z"));

    await create.execute({
      id: "workflow:persistence:auto-id",
      name: "Auto Id Source",
      draft: createValidDraft(),
    });

    const first = await duplicate.execute({
      sourceWorkflowId: "workflow:persistence:auto-id",
    });
    const second = await duplicate.execute({
      sourceWorkflowId: "workflow:persistence:auto-id",
    });

    expect(first.id).toBe("workflow:persistence:auto-id:copy");
    expect(second.id).toBe("workflow:persistence:auto-id:copy-2");
  });

  it("allows duplicated workflows to be edited independently without mutating the source workflow", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const duplicate = new DuplicatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:10:00.000Z"));
    const update = new UpdatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:15:00.000Z"));
    const get = new GetPersistedWorkflowUseCase(repository);

    await create.execute({
      id: "workflow:persistence:independent-source",
      name: "Independent Source",
      draft: createValidDraft(),
      metadata: { tags: ["source"] },
    });

    const copy = await duplicate.execute({
      sourceWorkflowId: "workflow:persistence:independent-source",
      duplicatedWorkflowName: "Independent Source Copy",
    });

    await update.execute({
      id: copy.id,
      changes: {
        name: "Independent Source Copy Updated",
        metadata: { tags: ["copy-updated"] },
        draft: createValidDraft(),
      },
    });

    const source = await get.execute("workflow:persistence:independent-source");
    const updatedCopy = await get.execute(copy.id);

    expect(source?.name).toBe("Independent Source");
    expect(source?.metadata.tags).toEqual(["source"]);
    expect(source?.revision.persistenceRevision).toBe(1);
    expect(updatedCopy?.name).toBe("Independent Source Copy Updated");
    expect(updatedCopy?.metadata.tags).toEqual(["copy-updated"]);
    expect(updatedCopy?.revision.persistenceRevision).toBe(2);
  });

  it("enforces validation and explicit errors for invalid/missing requests and missing records", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const update = new UpdatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:05:00.000Z"));
    const get = new GetPersistedWorkflowUseCase(repository);
    const duplicate = new DuplicatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:10:00.000Z"));

    await expect(create.execute({
      id: "workflow:persistence:invalid-draft",
      name: "Invalid Draft",
      draft: { triggers: [], inputs: [], steps: [], outputs: [] },
    })).rejects.toBeInstanceOf(WorkflowPersistenceInvalidRequestError);

    await create.execute({
      id: "workflow:persistence:exists",
      name: "Exists",
      draft: createValidDraft(),
    });
    await expect(create.execute({
      id: "workflow:persistence:exists",
      name: "Exists Again",
      draft: createValidDraft(),
    })).rejects.toBeInstanceOf(WorkflowPersistenceConflictError);

    await expect(get.execute("   ")).rejects.toBeInstanceOf(WorkflowPersistenceInvalidRequestError);
    await expect(update.execute({
      id: "workflow:persistence:missing",
      changes: { name: "Missing" },
    })).rejects.toBeInstanceOf(WorkflowPersistenceNotFoundError);
    await expect(update.execute({
      id: "workflow:persistence:exists",
      changes: { name: "   " },
    })).rejects.toBeInstanceOf(WorkflowPersistenceInvalidRequestError);
    await expect(duplicate.execute({
      sourceWorkflowId: "workflow:persistence:missing",
      duplicatedWorkflowId: "workflow:persistence:copy-missing",
    })).rejects.toBeInstanceOf(WorkflowPersistenceNotFoundError);
  });

  it("rejects stale expected persistence revisions for update operations", async () => {
    const repository = new InMemoryWorkflowPersistenceRepository();
    const create = new CreatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:00:00.000Z"));
    const update = new UpdatePersistedWorkflowUseCase(repository, () => new Date("2026-03-30T10:05:00.000Z"));

    await create.execute({
      id: "workflow:persistence:stale",
      name: "Stale Revision Workflow",
      draft: createValidDraft(),
    });

    await expect(update.execute({
      id: "workflow:persistence:stale",
      changes: {
        name: "Renamed",
        expectedPersistenceRevision: 99,
      },
    })).rejects.toBeInstanceOf(WorkflowPersistenceConflictError);
  });

  it("maps adapter failures into typed persistence failure errors", async () => {
    const failingRepository: IWorkflowPersistenceRepository = {
      async create(record) {
        return record;
      },
      async update(record) {
        return record;
      },
      async getById() {
        throw new Error("db unavailable");
      },
      async list() {
        throw new Error("db unavailable");
      },
      async duplicate() {
        throw new Error("db unavailable");
      },
    };

    await expect(new GetPersistedWorkflowUseCase(failingRepository).execute("workflow:1"))
      .rejects.toBeInstanceOf(WorkflowPersistenceFailureError);
    await expect(new ListPersistedWorkflowsUseCase(failingRepository).execute())
      .rejects.toBeInstanceOf(WorkflowPersistenceFailureError);
    await expect(new DuplicatePersistedWorkflowUseCase(failingRepository).execute({ sourceWorkflowId: "workflow:1" }))
      .rejects.toBeInstanceOf(WorkflowPersistenceFailureError);
  });

  it("keeps canonical summary contract stable for list projections", async () => {
    const now = new Date("2026-03-30T10:00:00.000Z");
    const record = createPersistedWorkflowRecord({
      id: "workflow:persistence:summary",
      name: "Summary Workflow",
      draft: createValidDraft(),
      now,
    });

    expect(record.payload.kind).toBe("workflow-entity");
    expect(record.timestamps.createdAt).toBe("2026-03-30T10:00:00.000Z");
    expect(record.revision.workflowRevision).toBe(1);
  });
});
