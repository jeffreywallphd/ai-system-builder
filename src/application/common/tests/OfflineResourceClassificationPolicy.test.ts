import { describe, expect, it } from "bun:test";
import {
  OfflineDeviceTrustPostures,
  OfflineResourceClasses,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import {
  classifyOfflineResourceLocalModePolicy,
  classifyOfflineResourcePolicyMatrix,
} from "../OfflineResourceClassificationPolicy";

describe("OfflineResourceClassificationPolicy", () => {
  it("evaluates a single resource posture from structured policy input", () => {
    const evaluation = classifyOfflineResourceLocalModePolicy({
      resourceClass: OfflineResourceClasses.workflowDraft,
      policy: {
        workspaceVisibility: WorkspaceVisibilities.private,
        workspaceAccessRole: OfflineWorkspaceAccessRoles.member,
        workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
        sensitivityMarking: OfflineSensitivityMarkings.standard,
        storageRule: OfflineStorageRules.allowOfflineCache,
        deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
      },
    });

    expect(evaluation.supportedResourceClass).toBeTrue();
    expect(evaluation.posture.read.allowed).toBeTrue();
    expect(evaluation.posture.edit.allowed).toBeTrue();
    expect(evaluation.posture.queueMutation.allowed).toBeTrue();
  });

  it("produces full policy-matrix coverage for registered resource classes", () => {
    const matrix = classifyOfflineResourcePolicyMatrix({
      policy: {
        workspaceVisibility: WorkspaceVisibilities.team,
        workspaceAccessRole: OfflineWorkspaceAccessRoles.admin,
        workspaceSharingPosture: OfflineWorkspaceSharingPostures.tenantWide,
        sensitivityMarking: OfflineSensitivityMarkings.standard,
        storageRule: OfflineStorageRules.allowOfflineCache,
        deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
      },
    });

    expect(matrix).toHaveLength(Object.keys(OfflineResourceClasses).length);
    expect(matrix.find((entry) => entry.resourceClass === OfflineResourceClasses.secretPlaintextMaterial)?.posture.read.allowed)
      .toBeFalse();
  });
});
