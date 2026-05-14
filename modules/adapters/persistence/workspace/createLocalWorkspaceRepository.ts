import type { WorkspaceRepository } from "../../../application/ports/workspace";
import {
  type WorkspaceId,
  type WorkspaceRecord,
  isWorkspaceId,
  isWorkspaceStatus,
} from "../../../contracts/workspace";
import { LocalWorkspacePersistenceError } from "./localWorkspacePersistenceErrors";
import { cloneJson, readJsonDocument, writeJsonDocument } from "./localWorkspacePersistenceJson";
import {
  resolveWorkspaceIndexFile,
  resolveWorkspaceRecordFile,
} from "./localWorkspacePersistencePaths";

export interface LocalWorkspaceRepositoryOptions {
  readonly rootDirectory: string;
}

export function createLocalWorkspaceRepository(options: LocalWorkspaceRepositoryOptions): WorkspaceRepository {
  const rootDirectory = options.rootDirectory;

  async function readIndex(): Promise<WorkspaceRecord[]> {
    const value = await readJsonDocument<unknown>(resolveWorkspaceIndexFile(rootDirectory), [], "workspace-persistence-read-failed");
    if (!Array.isArray(value)) {
      throw new LocalWorkspacePersistenceError("workspace-persistence-invalid-record");
    }

    return sortWorkspaces(value.map(assertWorkspaceRecord));
  }

  async function writeIndex(records: readonly WorkspaceRecord[]): Promise<void> {
    await writeJsonDocument(resolveWorkspaceIndexFile(rootDirectory), sortWorkspaces(records), "workspace-persistence-write-failed");
  }

  async function writeWorkspaceRecord(workspace: WorkspaceRecord): Promise<void> {
    await writeJsonDocument(resolveWorkspaceRecordFile(rootDirectory, workspace.workspaceId), workspace, "workspace-persistence-write-failed");
  }

  return {
    async listWorkspaces(): Promise<readonly WorkspaceRecord[]> {
      return cloneJson(await readIndex());
    },

    async readWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceRecord | undefined> {
      const safeWorkspaceId = assertWorkspaceId(workspaceId);
      const value = await readJsonDocument<unknown | undefined>(
        resolveWorkspaceRecordFile(rootDirectory, safeWorkspaceId),
        undefined,
        "workspace-persistence-read-failed",
      );
      if (value === undefined) return undefined;
      return cloneJson(assertWorkspaceRecord(value));
    },

    async saveWorkspace(workspace: WorkspaceRecord): Promise<void> {
      const validWorkspace = assertWorkspaceRecord(workspace);
      await writeWorkspaceRecord(validWorkspace);
      const index = await readIndex();
      await writeIndex(upsertWorkspace(index, validWorkspace));
    },

    async updateWorkspace(workspace: WorkspaceRecord): Promise<void> {
      const validWorkspace = assertWorkspaceRecord(workspace);
      await writeWorkspaceRecord(validWorkspace);
      const index = await readIndex();
      await writeIndex(upsertWorkspace(index, validWorkspace));
    },

    async archiveWorkspace(workspaceId: WorkspaceId, archivedAt: string): Promise<WorkspaceRecord | undefined> {
      const existing = await this.readWorkspace(workspaceId);
      if (!existing) return undefined;
      const archived: WorkspaceRecord = {
        ...existing,
        status: "archived",
        updatedAt: archivedAt,
      };
      await this.updateWorkspace(archived);
      return cloneJson(archived);
    },
  };
}

function upsertWorkspace(records: readonly WorkspaceRecord[], workspace: WorkspaceRecord): WorkspaceRecord[] {
  return sortWorkspaces([
    ...records.filter((record) => record.workspaceId !== workspace.workspaceId),
    cloneJson(workspace),
  ]);
}

function sortWorkspaces(records: readonly WorkspaceRecord[]): WorkspaceRecord[] {
  return [...records].sort((left, right) => {
    const created = left.createdAt.localeCompare(right.createdAt);
    if (created !== 0) return created;
    return String(left.workspaceId).localeCompare(String(right.workspaceId));
  });
}

function assertWorkspaceRecord(value: unknown): WorkspaceRecord {
  if (!value || typeof value !== "object") {
    throw new LocalWorkspacePersistenceError("workspace-persistence-invalid-record");
  }
  const record = value as Partial<WorkspaceRecord>;
  if (
    !isWorkspaceId(record.workspaceId) ||
    typeof record.displayName !== "string" ||
    record.displayName.trim().length === 0 ||
    !isWorkspaceStatus(record.status) ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new LocalWorkspacePersistenceError("workspace-persistence-invalid-record");
  }

  return cloneJson(record as WorkspaceRecord);
}

function assertWorkspaceId(workspaceId: WorkspaceId): WorkspaceId {
  if (!isWorkspaceId(workspaceId)) {
    throw new LocalWorkspacePersistenceError("workspace-persistence-invalid-record");
  }
  return workspaceId;
}
