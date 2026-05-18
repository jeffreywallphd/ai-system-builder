import type {
  WorkspaceUserLibraryLinkAssetListQuery,
  WorkspaceUserLibraryLinkFindExistingQuery,
  WorkspaceUserLibraryLinkListQuery,
  WorkspaceUserLibraryLinkRepositoryPort,
} from "../../../application/ports/user-library";
import type { WorkspaceId } from "../../../contracts/workspace";
import type { UserLibraryLinkId, WorkspaceUserLibraryLinkRecord } from "../../../contracts/user-library";
import {
  createUserLibraryAssetId,
  createUserLibraryAssetVersion,
  createUserLibraryLinkId,
  isUserLibraryPropagationPolicy,
  isWorkspaceUserLibraryLinkStatus,
} from "../../../contracts/user-library";
import { createWorkspaceId } from "../../../contracts/workspace";
import { cloneJson, LocalUserLibraryRecordStore, type LocalUserLibraryRecordStoreOptions } from "./local-user-library-record-store";
import { pageRecords, replaceRecord, textValuesMatch, upsertRecord, userLibraryAssetReferenceEquals } from "./local-user-library-repository-helpers";

export function createLocalWorkspaceUserLibraryLinkRepositoryAdapter(
  options: LocalUserLibraryRecordStoreOptions,
): WorkspaceUserLibraryLinkRepositoryPort {
  const store = new LocalUserLibraryRecordStore(options);

  return {
    async saveWorkspaceUserLibraryLinkRecord(record: WorkspaceUserLibraryLinkRecord): Promise<WorkspaceUserLibraryLinkRecord> {
      const validRecord = assertWorkspaceUserLibraryLinkRecord(record);
      const links = await store.readCollection("workspaceLinks");
      await store.writeCollection("workspaceLinks", sortLinks(upsertRecord(links, validRecord, linkStorageKey)));
      return cloneJson(validRecord);
    },

    async updateWorkspaceUserLibraryLinkRecord(record: WorkspaceUserLibraryLinkRecord): Promise<WorkspaceUserLibraryLinkRecord> {
      const validRecord = assertWorkspaceUserLibraryLinkRecord(record);
      const links = await store.readCollection("workspaceLinks");
      await store.writeCollection("workspaceLinks", sortLinks(replaceRecord(links, validRecord, linkStorageKey, "Workspace user-library link record does not exist.")));
      return cloneJson(validRecord);
    },

    async readWorkspaceUserLibraryLinkRecord(
      targetWorkspaceId: WorkspaceId,
      linkId: UserLibraryLinkId,
    ): Promise<WorkspaceUserLibraryLinkRecord | undefined> {
      const safeWorkspaceId = createWorkspaceId(targetWorkspaceId);
      const safeLinkId = createUserLibraryLinkId(linkId);
      const match = (await store.readCollection("workspaceLinks")).find(
        (link) => link.targetWorkspaceId === safeWorkspaceId && link.linkId === safeLinkId,
      );
      return match ? cloneJson(match) : undefined;
    },

    async listWorkspaceUserLibraryLinkRecords(query: WorkspaceUserLibraryLinkListQuery) {
      const safeWorkspaceId = createWorkspaceId(query.targetWorkspaceId);
      const links = sortLinks(
        (await store.readCollection("workspaceLinks"))
          .map(assertWorkspaceUserLibraryLinkRecord)
          .filter((link) => matchesWorkspaceLink(link, { ...query, targetWorkspaceId: safeWorkspaceId })),
      );
      const page = pageRecords(links, query.limit, query.cursor);
      return { links: page.records, nextCursor: page.nextCursor };
    },

    async listWorkspaceUserLibraryLinkRecordsByAsset(query: WorkspaceUserLibraryLinkAssetListQuery) {
      const safeWorkspaceId = createWorkspaceId(query.targetWorkspaceId);
      const links = sortLinks(
        (await store.readCollection("workspaceLinks"))
          .map(assertWorkspaceUserLibraryLinkRecord)
          .filter((link) => matchesAssetLink(link, { ...query, targetWorkspaceId: safeWorkspaceId })),
      );
      const page = pageRecords(links, query.limit, query.cursor);
      return { links: page.records, nextCursor: page.nextCursor };
    },

    async findWorkspaceUserLibraryLinkRecord(
      query: WorkspaceUserLibraryLinkFindExistingQuery,
    ): Promise<WorkspaceUserLibraryLinkRecord | undefined> {
      const safeWorkspaceId = createWorkspaceId(query.targetWorkspaceId);
      const links = sortLinks((await store.readCollection("workspaceLinks")).filter((link) => (
        link.targetWorkspaceId === safeWorkspaceId
        && userLibraryAssetReferenceEquals(link.userLibraryAssetReference, query.userLibraryAssetReference)
        && (!query.propagationPolicy || link.propagationPolicy === query.propagationPolicy)
      )));
      return links[0] ? cloneJson(links[0]) : undefined;
    },

    async archiveWorkspaceUserLibraryLinkRecord(
      targetWorkspaceId: WorkspaceId,
      linkId: UserLibraryLinkId,
      archivedAt: string,
    ): Promise<WorkspaceUserLibraryLinkRecord | undefined> {
      const existing = await this.readWorkspaceUserLibraryLinkRecord(targetWorkspaceId, linkId);
      if (!existing) return undefined;
      const archived: WorkspaceUserLibraryLinkRecord = { ...existing, status: "archived", updatedAt: archivedAt };
      return this.updateWorkspaceUserLibraryLinkRecord(archived);
    },
  };
}

function matchesWorkspaceLink(link: WorkspaceUserLibraryLinkRecord, query: WorkspaceUserLibraryLinkListQuery): boolean {
  if (link.targetWorkspaceId !== query.targetWorkspaceId) return false;
  if (query.status && link.status !== query.status) return false;
  if (query.propagationPolicy && link.propagationPolicy !== query.propagationPolicy) return false;
  if (query.userLibraryAssetReference && !userLibraryAssetReferenceEquals(link.userLibraryAssetReference, query.userLibraryAssetReference)) return false;
  return textValuesMatch([
    String(link.linkId),
    String(link.userLibraryAssetReference.assetId),
    link.userLibraryAssetReference.label,
    link.displayLabel,
  ], query.text);
}

function matchesAssetLink(link: WorkspaceUserLibraryLinkRecord, query: WorkspaceUserLibraryLinkAssetListQuery): boolean {
  if (link.targetWorkspaceId !== query.targetWorkspaceId) return false;
  if (query.status && link.status !== query.status) return false;
  return userLibraryAssetReferenceEquals(link.userLibraryAssetReference, query.userLibraryAssetReference);
}

function sortLinks(records: readonly WorkspaceUserLibraryLinkRecord[]): WorkspaceUserLibraryLinkRecord[] {
  return [...records].sort((left, right) => {
    const workspace = String(left.targetWorkspaceId).localeCompare(String(right.targetWorkspaceId));
    if (workspace !== 0) return workspace;
    const updated = right.updatedAt.localeCompare(left.updatedAt);
    if (updated !== 0) return updated;
    return String(left.linkId).localeCompare(String(right.linkId));
  });
}

function linkStorageKey(record: WorkspaceUserLibraryLinkRecord): string {
  return `${record.targetWorkspaceId}::${record.linkId}`;
}

function assertWorkspaceUserLibraryLinkRecord(record: WorkspaceUserLibraryLinkRecord): WorkspaceUserLibraryLinkRecord {
  createUserLibraryLinkId(record.linkId);
  createWorkspaceId(record.targetWorkspaceId);
  createUserLibraryAssetId(record.userLibraryAssetReference.assetId);
  if (record.userLibraryAssetReference.version) createUserLibraryAssetVersion(record.userLibraryAssetReference.version);
  if (!isWorkspaceUserLibraryLinkStatus(record.status) || !isUserLibraryPropagationPolicy(record.propagationPolicy)) {
    throw new Error("Workspace user-library link record is invalid.");
  }
  return cloneJson(record);
}
