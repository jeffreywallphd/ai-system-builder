import { rm } from "node:fs/promises";

import type { WorkspaceSelectionRepository } from "../../../application/ports/workspace";
import {
  type ActiveWorkspaceSelection,
  isWorkspaceId,
} from "../../../contracts/workspace";
import { LocalWorkspacePersistenceError } from "./localWorkspacePersistenceErrors";
import { cloneJson, readJsonDocument, writeJsonDocument } from "./localWorkspacePersistenceJson";
import { resolveActiveWorkspaceSelectionFile } from "./localWorkspacePersistencePaths";

export interface LocalWorkspaceSelectionRepositoryOptions {
  readonly rootDirectory: string;
}

const EMPTY_SELECTION: ActiveWorkspaceSelection = {};

export function createLocalWorkspaceSelectionRepository(options: LocalWorkspaceSelectionRepositoryOptions): WorkspaceSelectionRepository {
  const selectionFile = resolveActiveWorkspaceSelectionFile(options.rootDirectory);

  return {
    async readActiveWorkspaceSelection(): Promise<ActiveWorkspaceSelection> {
      const value = await readJsonDocument<unknown>(selectionFile, EMPTY_SELECTION, "workspace-selection-persistence-read-failed");
      return normalizeSelection(value);
    },

    async saveActiveWorkspaceSelection(selection: ActiveWorkspaceSelection): Promise<void> {
      await writeJsonDocument(selectionFile, normalizeSelection(selection), "workspace-selection-persistence-write-failed");
    },

    async clearActiveWorkspaceSelection(): Promise<void> {
      try {
        await rm(selectionFile, { force: true });
      } catch (error) {
        throw new LocalWorkspacePersistenceError("workspace-selection-persistence-write-failed", { cause: error });
      }
    },
  };
}

function normalizeSelection(value: unknown): ActiveWorkspaceSelection {
  if (!value || typeof value !== "object") return EMPTY_SELECTION;
  const selection = value as Partial<ActiveWorkspaceSelection>;
  if (selection.workspaceId === undefined && selection.selectedAt === undefined) {
    return EMPTY_SELECTION;
  }
  if (!isWorkspaceId(selection.workspaceId) || typeof selection.selectedAt !== "string") {
    return EMPTY_SELECTION;
  }

  return cloneJson({
    workspaceId: selection.workspaceId,
    selectedAt: selection.selectedAt,
  });
}
