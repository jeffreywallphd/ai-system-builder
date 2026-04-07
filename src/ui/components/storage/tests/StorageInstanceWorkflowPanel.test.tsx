import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StorageManagedActions } from "../../../../domain/storage/StorageDomain";
import type { GetStorageInstanceDetailApiResponse } from "../../../../infrastructure/api/storage/sdk/PublicStorageManagementApiContract";
import StorageInstanceWorkflowPanel, { StorageInstanceWorkflowPanelPresentation } from "../StorageInstanceWorkflowPanel";
import type { StorageAdministrationService } from "../../../services/StorageAdministrationService";

describe("StorageInstanceWorkflowPanel", () => {
  it("renders create and edit workflow controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(StorageInstanceWorkflowPanel, {
        workspaceId: "workspace-1",
        onWorkspaceIdChange: () => undefined,
        actorUserIdentityId: "user-admin-1",
        sessionToken: "token-1",
        service: {} as StorageAdministrationService,
        selectedStorage: undefined,
        onMutationComplete: async () => undefined,
      }),
    );

    expect(html).toContain("Create and edit workflows");
    expect(html).toContain("Create storage");
    expect(html).toContain("Save selected metadata");
    expect(html).toContain("Lifecycle actions");
    expect(html).toContain("Policy labels (key=value per line)");
  });

  it("renders activate lifecycle action when access and lifecycle rules allow activation", () => {
    const html = renderToStaticMarkup(
      React.createElement(StorageInstanceWorkflowPanel, {
        workspaceId: "workspace-1",
        onWorkspaceIdChange: () => undefined,
        actorUserIdentityId: "user-admin-1",
        sessionToken: "token-1",
        service: {} as StorageAdministrationService,
        selectedStorage: createStorageDetail({
          lifecycle: {
            state: "suspended",
            createdAt: "2026-04-06T09:00:00.000Z",
            lastModifiedAt: "2026-04-06T09:30:00.000Z",
          },
          access: {
            workspaceId: "workspace-1",
            ownerUserIdentityId: "user-admin-1",
            mode: "read-write",
            scope: "workspace-members",
            isOwner: true,
            source: "ownership-default",
            effectivePermissions: [],
            allowedActions: [StorageManagedActions.activate],
            policyRestrictedCapabilities: [],
          },
        }),
        onMutationComplete: async () => undefined,
      }),
    );

    expect(html).toContain("Activate storage");
    expect(html).not.toContain("Deactivate storage");
  });

  it("does not render lifecycle actions when access summary does not allow them", () => {
    const html = renderToStaticMarkup(
      React.createElement(StorageInstanceWorkflowPanel, {
        workspaceId: "workspace-1",
        onWorkspaceIdChange: () => undefined,
        actorUserIdentityId: "user-admin-1",
        sessionToken: "token-1",
        service: {} as StorageAdministrationService,
        selectedStorage: createStorageDetail({
          access: {
            workspaceId: "workspace-1",
            ownerUserIdentityId: "user-admin-1",
            mode: "read-write",
            scope: "workspace-members",
            isOwner: true,
            source: "ownership-default",
            effectivePermissions: [],
            allowedActions: [StorageManagedActions.view],
            policyRestrictedCapabilities: [],
          },
        }),
        onMutationComplete: async () => undefined,
      }),
    );

    expect(html).not.toContain("Activate storage");
    expect(html).not.toContain("Deactivate storage");
    expect(html).toContain("Lifecycle actions are unavailable for the selected storage");
  });

  it("evaluates lifecycle availability from allowed actions and lifecycle state", () => {
    const activate = StorageInstanceWorkflowPanelPresentation.evaluateLifecycleActionAvailability(createStorageDetail({
      lifecycle: {
        state: "suspended",
        createdAt: "2026-04-06T09:00:00.000Z",
        lastModifiedAt: "2026-04-06T09:30:00.000Z",
      },
      access: {
        workspaceId: "workspace-1",
        ownerUserIdentityId: "user-admin-1",
        mode: "read-write",
        scope: "workspace-members",
        isOwner: true,
        source: "ownership-default",
        effectivePermissions: [],
        allowedActions: [StorageManagedActions.activate],
        policyRestrictedCapabilities: [],
      },
    }));
    const deactivate = StorageInstanceWorkflowPanelPresentation.evaluateLifecycleActionAvailability(createStorageDetail({
      lifecycle: {
        state: "active",
        createdAt: "2026-04-06T09:00:00.000Z",
        lastModifiedAt: "2026-04-06T09:30:00.000Z",
      },
      access: {
        workspaceId: "workspace-1",
        ownerUserIdentityId: "user-admin-1",
        mode: "read-write",
        scope: "workspace-members",
        isOwner: true,
        source: "ownership-default",
        effectivePermissions: [],
        allowedActions: [StorageManagedActions.deactivate],
        policyRestrictedCapabilities: [],
      },
    }));

    expect(activate).toEqual({ canActivate: true, canDeactivate: false });
    expect(deactivate).toEqual({ canActivate: false, canDeactivate: true });
  });
});

function createStorageDetail(
  overrides: Partial<GetStorageInstanceDetailApiResponse["storage"]> = {},
): GetStorageInstanceDetailApiResponse["storage"] {
  return {
    storageInstanceId: "storage-images-1",
    workspaceId: "workspace-1",
    backendType: "managed-filesystem",
    display: {
      displayName: "Storage Images",
    },
    lifecycle: {
      state: "active",
      createdAt: "2026-04-06T09:00:00.000Z",
      lastModifiedAt: "2026-04-06T09:30:00.000Z",
    },
    ownerUserIdentityId: "user-admin-1",
    access: {
      workspaceId: "workspace-1",
      ownerUserIdentityId: "user-admin-1",
      mode: "read-write",
      scope: "workspace-members",
      isOwner: true,
      source: "ownership-default",
      effectivePermissions: [],
      allowedActions: [],
      policyRestrictedCapabilities: [],
    },
    policy: {
      policyId: "policy-storage-1",
      immutableWrites: true,
      allowCrossWorkspaceReads: false,
      labels: {},
      encryptionMode: "platform-managed",
      contentEncryptionRequired: true,
      keyScope: "workspace",
      allowPreviewDecryption: false,
      allowWorkerDecryption: false,
      retentionExpiryAction: "none",
      encryptionProfileId: "enc-profile-1",
      envelopeRequired: true,
      hasEncryptionKeyReference: false,
    },
    replication: {
      mode: "none",
      lastSyncStatus: "disabled",
    },
    ...overrides,
  };
}
