import { describe, expect, it } from "bun:test";
import {
  normalizeWorkspaceInvitationLookupEmail,
  normalizeWorkspaceMutationOperationKey,
} from "../WorkspacePersistenceDtos";

describe("WorkspacePersistenceDtos", () => {
  it("normalizes operation keys and invitation lookup email", () => {
    expect(normalizeWorkspaceMutationOperationKey("  Workspace-INVITE-001 ")).toBe("workspace-invite-001");
    expect(normalizeWorkspaceInvitationLookupEmail("  USER@EXAMPLE.COM ")).toBe("user@example.com");
    expect(normalizeWorkspaceInvitationLookupEmail("  ")).toBeUndefined();
  });
});
