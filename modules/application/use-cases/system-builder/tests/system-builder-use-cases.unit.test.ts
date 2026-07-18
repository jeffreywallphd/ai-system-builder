import { describe, expect, it } from "../../../../testing/node-test";
import { createInMemoryStructuredDocumentStore } from "../../../../adapters/persistence/shared";
import { createStructuredSystemBuilderRepository } from "../../../../adapters/persistence/system-builder";
import { createWorkspaceId } from "../../../../contracts/workspace";
import type { SystemBuilderValidationResult } from "../../../../contracts/system-builder";
import {
  ArchiveSystemBuilderSystemUseCase,
  CloneSystemBuilderSystemUseCase,
  CreateSystemBuilderSystemUseCase,
  ListSystemBuilderSystemsUseCase,
  ReadSystemBuilderRevisionUseCase,
  RestoreSystemBuilderSystemUseCase,
  SaveSystemBuilderRevisionUseCase,
} from "../system-builder-use-cases";

const workspaceId = createWorkspaceId("workspace-one");
const valid: SystemBuilderValidationResult = { status: "valid", issues: [], validatedAt: "2026-07-17T00:00:00.000Z" };

describe("System Builder use cases", () => {
  it("creates workspace-scoped records and immutable initial revisions", async () => {
    const repository = createStructuredSystemBuilderRepository(createInMemoryStructuredDocumentStore());
    const create = new CreateSystemBuilderSystemUseCase({ repository, validator: { execute: async () => valid }, generateSystemId: () => "system-one", now: () => "2026-07-17T00:00:00.000Z" });
    const created = await create.execute({ workspaceId, name: "  Customer portal  ", actorId: "user-1" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.name).toBe("Customer portal");
    expect(created.value.revision).toBe(1);
    expect((await repository.listRecords(createWorkspaceId("workspace-two"))).length).toBe(0);
    expect((await repository.listRevisions(workspaceId, created.value.systemId)).map((item) => item.revisionNumber)).toEqual([1]);
  });

  it("saves validated revisions atomically and rejects stale updates", async () => {
    const repository = createStructuredSystemBuilderRepository(createInMemoryStructuredDocumentStore());
    const dependencies = { repository, validator: { execute: async () => valid }, generateSystemId: () => "system-save", now: () => "2026-07-17T00:00:00.000Z" };
    const created = await new CreateSystemBuilderSystemUseCase(dependencies).execute({ workspaceId, name: "Save test", actorId: "user-1" });
    if (!created.ok) throw new Error(created.error.message);
    const save = new SaveSystemBuilderRevisionUseCase(dependencies);
    const saved = await save.execute({ workspaceId, systemId: created.value.systemId, expectedRecordRevision: 1, actorId: "user-1", composition: created.value.composition, instances: [], bindings: [] });
    expect(saved.ok).toBe(true);
    expect((await repository.readRecord(workspaceId, created.value.systemId))?.revision).toBe(2);
    const stale = await save.execute({ workspaceId, systemId: created.value.systemId, expectedRecordRevision: 1, actorId: "user-1", composition: created.value.composition, instances: [], bindings: [] });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("system-builder.stale");
    expect((await repository.listRevisions(workspaceId, created.value.systemId)).length).toBe(2);
  });

  it("archives, restores, clones, and reads the clone revision without mutating its source", async () => {
    const repository = createStructuredSystemBuilderRepository(createInMemoryStructuredDocumentStore());
    let id = 0;
    const dependencies = { repository, validator: { execute: async () => valid }, generateSystemId: () => `system-${++id}`, now: () => "2026-07-17T00:00:00.000Z" };
    const created = await new CreateSystemBuilderSystemUseCase(dependencies).execute({ workspaceId, name: "Source", actorId: "user-1" });
    if (!created.ok) throw new Error(created.error.message);
    const archived = await new ArchiveSystemBuilderSystemUseCase(dependencies).execute({ workspaceId, systemId: created.value.systemId, expectedRevision: 1, actorId: "user-1" });
    expect(archived.ok && archived.value.status).toBe("archived");
    if (!archived.ok) return;
    const restored = await new RestoreSystemBuilderSystemUseCase(dependencies).execute({ workspaceId, systemId: archived.value.systemId, expectedRevision: 2, actorId: "user-1" });
    expect(restored.ok && restored.value.status).toBe("draft");
    const cloned = await new CloneSystemBuilderSystemUseCase(dependencies).execute({ workspaceId, sourceSystemId: created.value.systemId, name: "Clone", actorId: "user-1" });
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    expect(cloned.value.systemId).not.toBe(created.value.systemId);
    const cloneRevision = await new ReadSystemBuilderRevisionUseCase(repository).execute({ workspaceId, systemId: cloned.value.systemId });
    expect(cloneRevision.ok && cloneRevision.value.composition.displayName).toBe("Clone");
    expect((await new ListSystemBuilderSystemsUseCase(repository).execute({ workspaceId })).map((item) => item.name).sort()).toEqual(["Clone", "Source"]);
  });
});
