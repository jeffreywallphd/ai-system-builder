import type {
  AssetMutationProvenance,
  AssetProvenance,
  AssetReference,
  AssetResourceBackedView,
  AssetSourceIdentity,
  RegisterResourceBackedViewCommand,
} from "../../../contracts/asset";
import { sanitizeAssetMetadata, sanitizeAssetStringValue, sanitizeAssetViewValue } from "./asset-safe-metadata";

export class AssetMutationProvenanceService {
  public createForResourceBackedRegistration(input: {
    readonly command: RegisterResourceBackedViewCommand;
    readonly sourceIdentity: AssetSourceIdentity;
    readonly sourceView: AssetResourceBackedView;
    readonly createdAt: string;
  }): AssetMutationProvenance {
    const createdProvenance = this.createAssetProvenance(input);
    return {
      sourceIdentity: input.sourceIdentity,
      operation: "asset.register-resource-backed-view",
      actor: {
        initiatedBy: input.command.actor.initiatedBy,
        actorRef: sanitizeAssetStringValue(input.command.actor.actorRef),
        actorDisplayName: sanitizeAssetStringValue(input.command.actor.actorDisplayName),
        automationSafe: input.command.actor.automationSafe,
        thinClientSafe: input.command.actor.thinClientSafe,
      },
      approvalSummary: {
        userConfirmed: input.command.approval.userConfirmed,
        confirmationKind: input.command.approval.confirmationKind,
        confirmationTextVersion: sanitizeAssetStringValue(input.command.approval.confirmationTextVersion),
        allowNetworkAccess: input.command.approval.allowNetworkAccess,
        allowFilesystemWrite: input.command.approval.allowFilesystemWrite,
        allowCredentialUse: input.command.approval.allowCredentialUse,
        allowPartialCompletion: input.command.approval.allowPartialCompletion,
      },
      createdProvenance,
      reviewStatus: "reviewed",
      sourceSnapshot: {
        viewId: input.sourceIdentity.sourceViewId,
        viewKind: input.sourceView.viewKind,
        assetType: input.sourceView.assetType,
        assetFamily: input.sourceView.assetFamily,
        displayName: sanitizeAssetStringValue(input.sourceView.displayName),
        sourceRef: sanitizeAssetViewValue(input.sourceView.sourceRef),
        resourceBacking: input.sourceView.resourceBacking
          ? {
              backingId: input.sourceView.resourceBacking.backingId,
              resourceKind: input.sourceView.resourceBacking.resourceKind,
              role: input.sourceView.resourceBacking.role,
              contentType: input.sourceView.resourceBacking.contentType,
              format: input.sourceView.resourceBacking.format,
              sizeBytes: input.sourceView.resourceBacking.sizeBytes,
            }
          : undefined,
        metadata: sanitizeAssetMetadata(input.sourceView.metadata),
      },
    };
  }

  public createAssetProvenance(input: {
    readonly command: RegisterResourceBackedViewCommand;
    readonly sourceIdentity: AssetSourceIdentity;
    readonly sourceView: AssetResourceBackedView;
    readonly createdAt: string;
  }): AssetProvenance {
    const sourceResourceRefs = sourceResourceRefsFor(input.sourceView);
    const actorName = sanitizeAssetStringValue(input.command.actor.actorDisplayName ?? input.command.actor.actorRef);
    return {
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      createdBy: actorName,
      updatedBy: actorName,
      sourceKind: sourceProvenanceKind(input.sourceView),
      sourceResourceRefs,
      derivedFromRefs: input.sourceView.sourceRef ? [input.sourceView.sourceRef] : undefined,
      authorship: input.command.actor.initiatedBy === "human"
        ? "human-authored"
        : input.command.actor.initiatedBy === "ai-assisted"
          ? "mixed"
          : "unknown",
      metadata: sanitizeAssetMetadata({
        operation: "asset.register-resource-backed-view",
        sourceViewId: input.sourceIdentity.sourceViewId,
        sourceViewKind: input.sourceIdentity.sourceViewKind,
        sourceSystem: input.sourceIdentity.sourceSystem,
        sourceId: input.sourceIdentity.sourceId,
        sourceFingerprint: input.sourceIdentity.sourceFingerprint,
        deduplicationKey: input.sourceIdentity.deduplicationKey,
        idempotencyKey: sanitizeAssetStringValue(input.command.context?.idempotencyKey),
        initiatedBy: input.command.actor.initiatedBy,
      }),
    };
  }
}

export const assetMutationProvenanceService = new AssetMutationProvenanceService();

function sourceProvenanceKind(view: AssetResourceBackedView): AssetProvenance["sourceKind"] {
  if (view.viewKind === "generated-output") return "runtime-generated";
  if (view.viewKind === "external-repository-object") return "imported";
  return "system-generated";
}

function sourceResourceRefsFor(view: AssetResourceBackedView): readonly AssetReference[] | undefined {
  const refs: AssetReference[] = [];
  for (const candidate of [
    view.sourceRef,
    view.resourceBackedAsset?.assetRef,
    view.resourceBackedAsset?.primaryBackingRef,
    ...(view.resourceBackedAsset?.previewRefs ?? []),
    assetReferenceFromUnknown(view.resourceBacking?.ref),
  ]) {
    if (candidate && !refs.some((ref) => ref.kind === candidate.kind && ref.id === candidate.id && ref.version === candidate.version)) {
      refs.push(candidate);
    }
  }
  return refs.length ? refs : undefined;
}

function assetReferenceFromUnknown(value: unknown): AssetReference | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== "string" || typeof record.id !== "string") return undefined;
  return sanitizeAssetViewValue(value) as AssetReference;
}
