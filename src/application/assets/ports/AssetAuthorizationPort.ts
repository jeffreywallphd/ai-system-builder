import type { Asset, AssetLifecycleState } from "@domain/assets/AssetDomain";

export const AssetAuthorizationActions = Object.freeze({
  registerAsset: "asset.register",
  viewAsset: "asset.view",
  listAssets: "asset.list",
  finalizeUpload: "asset.finalize-upload",
  authorizeDownload: "asset.authorize-download",
  resolvePreview: "asset.resolve-preview",
  registerGeneratedOutput: "asset.register-generated-output",
  archiveAsset: "asset.archive",
  deleteAsset: "asset.delete",
});

export type AssetAuthorizationAction =
  typeof AssetAuthorizationActions[keyof typeof AssetAuthorizationActions];

export interface AssetAuthorizationDecision {
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly message?: string;
  readonly occurredAt: string;
}

export interface AssetAuthorizationInput {
  readonly action: AssetAuthorizationAction;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId?: string;
  readonly assetOwnerUserId?: string;
  readonly assetLifecycleState?: AssetLifecycleState;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface AssetAuthorizationCandidateFilterInput {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly action: Extract<
    AssetAuthorizationAction,
    | typeof AssetAuthorizationActions.viewAsset
    | typeof AssetAuthorizationActions.resolvePreview
    | typeof AssetAuthorizationActions.authorizeDownload
  >;
  readonly candidateAssetIds: ReadonlyArray<string>;
  readonly occurredAt?: string;
}

export interface IAssetAuthorizationPort {
  evaluateAssetAction(input: AssetAuthorizationInput): Promise<AssetAuthorizationDecision>;
  resolveAccessibleAssetIds(input: AssetAuthorizationCandidateFilterInput): Promise<ReadonlyArray<string>>;
  canAccessAsset(input: {
    readonly actorUserId: string;
    readonly workspaceId: string;
    readonly action: AssetAuthorizationAction;
    readonly asset: Asset;
    readonly occurredAt?: string;
  }): Promise<AssetAuthorizationDecision>;
}


