import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  SharingPolicyModes,
  type PermissionKey,
  type ResourceOwnershipScope,
  type ResourceVisibility,
  type SharingPolicyMode,
} from "@domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
  createCatalogPermissionKey,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationPolicyDecisionEvaluationRequest,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";

export class ImageAssetAuthorizationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetAuthorizationContractError";
  }
}

export const ImageAssetAuthorizationResourceType = "image-asset";

export const ImageAssetAccessActions = Object.freeze({
  create: "create",
  viewMetadata: "view-metadata",
  downloadOriginal: "download-original",
  requestPreview: "request-preview",
  updateMetadata: "update-metadata",
  archive: "archive",
  delete: "delete",
  attachToRun: "attach-to-run",
} as const);

export type ImageAssetAccessAction =
  typeof ImageAssetAccessActions[keyof typeof ImageAssetAccessActions];

export interface ImageAssetAuthorizationActorReference {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly activeWorkspaceId?: string;
}

export interface ImageAssetAuthorizationResourceContext {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownershipScope: ResourceOwnershipScope;
  readonly ownerUserIdentityId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly sharingPolicyId?: string;
  readonly sharingPolicyVersion?: string;
  readonly allowResharing: boolean;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
}

export interface ImageAssetAccessPolicyEvaluationRequest {
  readonly action: ImageAssetAccessAction;
  readonly actor: ImageAssetAuthorizationActorReference;
  readonly workspaceId: string;
  readonly resource?: ImageAssetAuthorizationResourceContext;
  readonly asOf?: string;
  readonly includeDebugDetails?: boolean;
}

const ImageAssetAccessActionPermissionMap: Readonly<Record<ImageAssetAccessAction, PermissionKey>> = Object.freeze({
  [ImageAssetAccessActions.create]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "create"),
  [ImageAssetAccessActions.viewMetadata]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "read"),
  [ImageAssetAccessActions.downloadOriginal]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "read"),
  [ImageAssetAccessActions.requestPreview]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "read"),
  [ImageAssetAccessActions.updateMetadata]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "update"),
  [ImageAssetAccessActions.archive]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "update"),
  [ImageAssetAccessActions.delete]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "delete"),
  [ImageAssetAccessActions.attachToRun]: createCatalogPermissionKey(AuthorizationResourceFamilies.asset, "read"),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetAuthorizationContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const iso = value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new ImageAssetAuthorizationContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeResourceOwnershipScope(value: ResourceOwnershipScope): ResourceOwnershipScope {
  if (!Object.values(ResourceOwnershipScopes).includes(value)) {
    throw new ImageAssetAuthorizationContractError(`Resource ownership scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeVisibility(value: ResourceVisibility): ResourceVisibility {
  if (!Object.values(ResourceVisibilities).includes(value)) {
    throw new ImageAssetAuthorizationContractError(`Resource visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSharingPolicyMode(value: SharingPolicyMode): SharingPolicyMode {
  if (!Object.values(SharingPolicyModes).includes(value)) {
    throw new ImageAssetAuthorizationContractError(`Sharing policy mode '${String(value)}' is invalid.`);
  }
  return value;
}

function assertResourceContextInvariants(value: ImageAssetAuthorizationResourceContext): void {
  if (value.ownershipScope === ResourceOwnershipScopes.userPrivate && !value.ownerUserIdentityId) {
    throw new ImageAssetAuthorizationContractError(
      "User-private image assets require ownerUserIdentityId.",
    );
  }

  if (value.ownershipScope === ResourceOwnershipScopes.workspace && value.ownerUserIdentityId) {
    throw new ImageAssetAuthorizationContractError(
      "Workspace-owned image assets cannot include ownerUserIdentityId.",
    );
  }

  if (value.visibility === ResourceVisibilities.private) {
    if (value.ownershipScope !== ResourceOwnershipScopes.userPrivate) {
      throw new ImageAssetAuthorizationContractError(
        "Private image assets must use ownershipScope='user-private'.",
      );
    }
    if (value.sharingPolicyMode !== SharingPolicyModes.ownerOnly) {
      throw new ImageAssetAuthorizationContractError(
        "Private image assets require sharingPolicyMode='owner-only'.",
      );
    }
    if (value.sharingPolicyId) {
      throw new ImageAssetAuthorizationContractError(
        "Private image assets cannot include sharingPolicyId.",
      );
    }
  }

  if (value.visibility === ResourceVisibilities.workspace) {
    if (value.sharingPolicyMode !== SharingPolicyModes.workspaceMembers) {
      throw new ImageAssetAuthorizationContractError(
        "Workspace-visible image assets require sharingPolicyMode='workspace-members'.",
      );
    }
    if (value.sharingPolicyId) {
      throw new ImageAssetAuthorizationContractError(
        "Workspace-visible image assets cannot include sharingPolicyId.",
      );
    }
  }

  if (value.visibility === ResourceVisibilities.shared) {
    if (value.sharingPolicyMode !== SharingPolicyModes.explicit) {
      throw new ImageAssetAuthorizationContractError(
        "Shared image assets require sharingPolicyMode='explicit'.",
      );
    }
    if (!value.sharingPolicyId) {
      throw new ImageAssetAuthorizationContractError(
        "Shared image assets require sharingPolicyId.",
      );
    }
  }

  if (value.visibility === ResourceVisibilities.published) {
    if (value.sharingPolicyMode !== SharingPolicyModes.published) {
      throw new ImageAssetAuthorizationContractError(
        "Published image assets require sharingPolicyMode='published'.",
      );
    }
    if (!value.sharingPolicyId) {
      throw new ImageAssetAuthorizationContractError(
        "Published image assets require sharingPolicyId.",
      );
    }
    if (!value.isPublishedCapable) {
      throw new ImageAssetAuthorizationContractError(
        "Published image assets require isPublishedCapable=true.",
      );
    }
    if (!value.publishedAt) {
      throw new ImageAssetAuthorizationContractError(
        "Published image assets require publishedAt.",
      );
    }
  } else if (value.publishedAt) {
    throw new ImageAssetAuthorizationContractError(
      "Only published image assets may include publishedAt.",
    );
  }
}

function normalizeActor(
  value: ImageAssetAuthorizationActorReference,
): ImageAssetAuthorizationActorReference {
  const actorUserIdentityId = normalizeOptional(value.actorUserIdentityId);
  const actorServiceId = normalizeOptional(value.actorServiceId);
  if (!actorUserIdentityId && !actorServiceId) {
    throw new ImageAssetAuthorizationContractError(
      "Actor must include actorUserIdentityId or actorServiceId.",
    );
  }

  return Object.freeze({
    actorUserIdentityId,
    actorServiceId,
    activeWorkspaceId: normalizeOptional(value.activeWorkspaceId),
  });
}

export function resolveImageAssetRequiredPermission(
  action: ImageAssetAccessAction,
): PermissionKey {
  return ImageAssetAccessActionPermissionMap[action];
}

export function createImageAssetAuthorizationResourceContext(input: {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownershipScope: ResourceOwnershipScope;
  readonly ownerUserIdentityId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly sharingPolicyId?: string;
  readonly sharingPolicyVersion?: string;
  readonly allowResharing?: boolean;
  readonly isPublishedCapable?: boolean;
  readonly publishedAt?: string;
}): ImageAssetAuthorizationResourceContext {
  const value: ImageAssetAuthorizationResourceContext = Object.freeze({
    assetId: normalizeRequired(input.assetId, "Image asset resource assetId"),
    workspaceId: normalizeRequired(input.workspaceId, "Image asset resource workspaceId"),
    ownershipScope: normalizeResourceOwnershipScope(input.ownershipScope),
    ownerUserIdentityId: normalizeOptional(input.ownerUserIdentityId),
    visibility: normalizeVisibility(input.visibility),
    sharingPolicyMode: normalizeSharingPolicyMode(input.sharingPolicyMode),
    sharingPolicyId: normalizeOptional(input.sharingPolicyId),
    sharingPolicyVersion: normalizeOptional(input.sharingPolicyVersion),
    allowResharing: input.allowResharing ?? false,
    isPublishedCapable: input.isPublishedCapable ?? false,
    publishedAt: normalizeTimestamp(input.publishedAt, "Image asset resource publishedAt"),
  });

  assertResourceContextInvariants(value);
  return value;
}

export function toImageAssetPolicyDecisionEvaluationRequest(
  input: ImageAssetAccessPolicyEvaluationRequest,
): AuthorizationPolicyDecisionEvaluationRequest {
  const action = input.action;
  const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
  const actor = normalizeActor(input.actor);
  const requiredPermissionKey = resolveImageAssetRequiredPermission(action);

  if (action === ImageAssetAccessActions.create) {
    return Object.freeze({
      actor,
      requiredPermissionKey,
      target: {
        kind: "workspace-capability",
        workspaceId,
        capabilityResourceType: ImageAssetAuthorizationResourceType,
      },
      asOf: normalizeTimestamp(input.asOf, "asOf"),
      includeDebugDetails: input.includeDebugDetails ?? false,
    });
  }

  if (!input.resource) {
    throw new ImageAssetAuthorizationContractError(
      `Resource context is required for action '${action}'.`,
    );
  }

  if (input.resource.workspaceId !== workspaceId) {
    throw new ImageAssetAuthorizationContractError(
      "Resource workspaceId must match request workspaceId.",
    );
  }

  return Object.freeze({
    actor,
    requiredPermissionKey,
    target: {
      kind: "resource-instance",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: ImageAssetAuthorizationResourceType,
        resourceId: input.resource.assetId,
      },
    },
    asOf: normalizeTimestamp(input.asOf, "asOf"),
    includeDebugDetails: input.includeDebugDetails ?? false,
  });
}
