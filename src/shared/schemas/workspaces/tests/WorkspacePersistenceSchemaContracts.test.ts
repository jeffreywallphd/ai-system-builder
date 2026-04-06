import { describe, expect, it } from "bun:test";
import { WorkspaceStatuses } from "../../../../domain/workspaces/WorkspaceDomain";
import {
  WorkspaceInvitationPersistenceRecordSchema,
  WorkspacePersistenceRecordSchema,
  parseWorkspacePersistenceRecord,
} from "../WorkspacePersistenceSchemaContracts";

describe("WorkspacePersistenceSchemaContracts", () => {
  it("accepts valid workspace persistence payloads", () => {
    const parsed = WorkspacePersistenceRecordSchema.parse({
      workspaceId: "workspace-1",
      slug: "workspace-1",
      displayName: "Workspace One",
      status: WorkspaceStatuses.active,
      ownerUserIdentityId: "user-owner",
      visibility: "workspace",
      tenancy: {
        scope: "workspace",
        workspaceId: "workspace-1",
      },
      encryptionPolicy: {
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
      },
      createdAt: "2026-04-06T10:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-06T10:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
      schemaVersion: 1,
    });

    expect(parsed.workspaceId).toBe("workspace-1");
  });

  it("rejects invitation token hints without token hash", () => {
    expect(() => WorkspaceInvitationPersistenceRecordSchema.parse({
      invitationId: "invite-1",
      workspaceId: "workspace-1",
      invitedEmail: "user@example.com",
      invitedByUserIdentityId: "user-owner",
      invitedRoles: ["viewer"],
      invitationTokenHint: "abcd",
      status: "pending",
      createdAt: "2026-04-06T10:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-06T10:00:00.000Z",
      lastModifiedBy: "user-owner",
      expiresAt: "2026-04-07T10:00:00.000Z",
      tenancy: {
        scope: "workspace",
        workspaceId: "workspace-1",
      },
      sensitiveFields: [],
      revision: 1,
      schemaVersion: 1,
    })).toThrow("invitationTokenHash");
  });

  it("supports typed parse helper usage", () => {
    expect(() => parseWorkspacePersistenceRecord({
      workspaceId: "workspace-1",
    })).toThrow("WorkspacePersistenceRecord payload is invalid");
  });
});
