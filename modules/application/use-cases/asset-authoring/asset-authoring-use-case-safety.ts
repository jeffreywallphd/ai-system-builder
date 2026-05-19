import type { AssetCustomizationTarget, AssetOverrideScope } from "../../../contracts/asset-authoring";
import type { AssetCustomizationTargetDescriptor } from "../../ports/asset-authoring";

const scopeBySourceKind: Record<AssetCustomizationTarget["sourceKind"], AssetOverrideScope> = {
  "workspace-local-asset": "workspace-local",
  "user-library-linked-asset": "linked-user-library-asset",
  "user-library-copied-asset": "detached-copy",
  "workspace-imported-asset": "workspace-import",
  "system-owned-asset": "system-derived",
  "authored-asset": "authored-asset",
  "customized-asset": "workspace-local",
};

export const mapOverrideScopeForSourceKind = (sourceKind: AssetCustomizationTarget["sourceKind"]): AssetOverrideScope => scopeBySourceKind[sourceKind];

export const validateOverrideTargetSemantics = (target: AssetCustomizationTarget, found: AssetCustomizationTargetDescriptor): string | undefined => {
  if (target.targetWorkspaceId !== found.targetWorkspaceId) return "Target workspace mismatch.";
  if (target.sourceKind !== found.sourceKind) return "Target source kind mismatch.";
  if (target.effectiveAssetReference.id !== found.effectiveAssetReference.id || target.effectiveAssetReference.kind !== found.effectiveAssetReference.kind) return "Target reference mismatch.";
  if (found.status && found.status !== "active") return "Target relationship is not active.";
  if (found.supportsOverride === false) return "Target source does not support overrides.";
  const expectedScope = mapOverrideScopeForSourceKind(target.sourceKind);
  if (found.supportedScopes && !found.supportedScopes.includes(expectedScope)) return "Target override scope is unsupported.";
  if (target.sourceKind === "customized-asset") return "Customized-asset target chaining is deferred.";
  return undefined;
};
