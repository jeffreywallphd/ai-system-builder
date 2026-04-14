import { describe, expect, it } from "bun:test";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  ImageAssetAccessActions,
  ImageAssetAuthorizationContractError,
  ImageAssetAuthorizationResourceType,
  createImageAssetAuthorizationResourceContext,
  resolveImageAssetRequiredPermission,
  toImageAssetPolicyDecisionEvaluationRequest,
} from "../ImageAssetAuthorizationContracts";

describe("ImageAssetAuthorizationContracts", () => {
  it("maps image asset access actions to reusable authorization permission keys", () => {
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.create)).toBe("asset.create");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.viewMetadata)).toBe("asset.read");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.downloadOriginal)).toBe("asset.read");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.requestPreview)).toBe("asset.read");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.updateMetadata)).toBe("asset.update");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.archive)).toBe("asset.update");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.delete)).toBe("asset.delete");
    expect(resolveImageAssetRequiredPermission(ImageAssetAccessActions.attachToRun)).toBe("asset.read");
  });

  it("creates user-private image resource contexts", () => {
    const context = createImageAssetAuthorizationResourceContext({
      assetId: "image-asset:001",
      workspaceId: "workspace-alpha",
      ownershipScope: "user-private",
      ownerUserIdentityId: "user:owner-1",
      visibility: "private",
      sharingPolicyMode: "owner-only",
    });

    expect(context.ownershipScope).toBe("user-private");
    expect(context.ownerUserIdentityId).toBe("user:owner-1");
    expect(context.visibility).toBe("private");
  });

  it("creates workspace-owned image resource contexts", () => {
    const context = createImageAssetAuthorizationResourceContext({
      assetId: "image-asset:workspace-1",
      workspaceId: "workspace-alpha",
      ownershipScope: "workspace",
      visibility: "workspace",
      sharingPolicyMode: "workspace-members",
    });

    expect(context.ownershipScope).toBe("workspace");
    expect(context.ownerUserIdentityId).toBeUndefined();
    expect(context.visibility).toBe("workspace");
  });

  it("requires explicit sharing policy identity for shared visibility", () => {
    expect(() => createImageAssetAuthorizationResourceContext({
      assetId: "image-asset:shared-1",
      workspaceId: "workspace-alpha",
      ownershipScope: "workspace",
      visibility: "shared",
      sharingPolicyMode: "explicit",
    })).toThrow("Shared image assets require sharingPolicyId");
  });

  it("creates create-action policy requests as workspace capability checks", () => {
    const request = toImageAssetPolicyDecisionEvaluationRequest({
      action: ImageAssetAccessActions.create,
      actor: {
        actorUserIdentityId: "user:creator-1",
        activeWorkspaceId: "workspace-alpha",
      },
      workspaceId: "workspace-alpha",
    });

    expect(request.requiredPermissionKey).toBe("asset.create");
    expect(request.target.kind).toBe("workspace-capability");
    if (request.target.kind === "workspace-capability") {
      expect(request.target.workspaceId).toBe("workspace-alpha");
      expect(request.target.capabilityResourceType).toBe(AuthorizationResourceFamilies.asset);
    }
  });

  it("creates existing-resource policy requests for attach-to-run and metadata/download/preview checks", () => {
    const resource = createImageAssetAuthorizationResourceContext({
      assetId: "image-asset:attach-1",
      workspaceId: "workspace-alpha",
      ownershipScope: "workspace",
      visibility: "shared",
      sharingPolicyMode: "explicit",
      sharingPolicyId: "sharing-policy:image-assets",
    });

    const request = toImageAssetPolicyDecisionEvaluationRequest({
      action: ImageAssetAccessActions.attachToRun,
      actor: {
        actorServiceId: "service:run-submission",
        activeWorkspaceId: "workspace-alpha",
      },
      workspaceId: "workspace-alpha",
      resource,
    });

    expect(request.requiredPermissionKey).toBe("asset.read");
    expect(request.target.kind).toBe("resource-instance");
    if (request.target.kind === "resource-instance") {
      expect(request.target.resource.resourceFamily).toBe("asset");
      expect(request.target.resource.resourceType).toBe("image-asset");
      expect(request.target.resource.resourceId).toBe("image-asset:attach-1");
    }
  });

  it("rejects missing resource context for non-create actions", () => {
    expect(() => toImageAssetPolicyDecisionEvaluationRequest({
      action: ImageAssetAccessActions.downloadOriginal,
      actor: {
        actorUserIdentityId: "user:viewer-1",
      },
      workspaceId: "workspace-alpha",
    })).toThrow(ImageAssetAuthorizationContractError);
  });
});
