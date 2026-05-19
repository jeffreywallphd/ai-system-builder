import { normalizeAssetOverrideId, normalizeAssetOverrideRecord, normalizeCreateAssetOverrideCommand, type AssetAuthoringFailure, type CreateAssetOverrideCommand, type CreateAssetOverrideResult } from "../../../contracts/asset-authoring";
import type { AssetCustomizationTargetReaderPort, AssetOverrideRepositoryPort } from "../../ports/asset-authoring";
import { mapOverrideScopeForSourceKind, validateOverrideTargetSemantics } from "./asset-authoring-use-case-safety";

const nowIso = () => new Date().toISOString();
const fail = (code: AssetAuthoringFailure["code"], message: string): CreateAssetOverrideResult => ({ kind: "failure", failure: { code, message } });

export interface CreateAssetOverrideUseCaseDependencies { assetOverrideRepository: AssetOverrideRepositoryPort; targetReader: AssetCustomizationTargetReaderPort; now?: () => string; generateAssetOverrideId: () => string; }
export class CreateAssetOverrideUseCase {
  constructor(private readonly d: CreateAssetOverrideUseCaseDependencies) {}
  async execute(command: CreateAssetOverrideCommand): Promise<CreateAssetOverrideResult> { try {
    const c = normalizeCreateAssetOverrideCommand(command);
    if (c.targetWorkspaceId !== c.target.targetWorkspaceId) return fail("validation", "Target workspace id must match command workspace id.");
    const found = await this.d.targetReader.readCustomizationTargetByReference(c.targetWorkspaceId, c.target.effectiveAssetReference);
    if (!found) return fail("not-found", "Customization target relationship was not found.");
    const invalid = validateOverrideTargetSemantics(c.target, found); if (invalid) return fail(invalid.includes("deferred") ? "unsupported" : "conflict", invalid);
    if (c.target.sourceKind === "system-owned-asset" && mapOverrideScopeForSourceKind(c.target.sourceKind) !== "system-derived") return fail("validation", "System-owned target requires system-derived override scope.");
    const existing = await this.d.assetOverrideRepository.findActiveOverrideForTarget(c.targetWorkspaceId, c.target.effectiveAssetReference);
    if (existing) return fail("conflict", "An active override already exists for the customization target.");
    const at = (this.d.now ?? nowIso)();
    let overrideId;
    try { overrideId = normalizeAssetOverrideId(this.d.generateAssetOverrideId()); } catch { return fail("internal", "Generated override identifier is invalid."); }
    const record = normalizeAssetOverrideRecord({
      overrideId,
      targetWorkspaceId: c.targetWorkspaceId,
      customizationTarget: c.target,
      baseAssetReference: c.target.effectiveAssetReference,
      baseRevision: c.baseRevision ?? c.target.baseRevision,
      overrideScope: mapOverrideScopeForSourceKind(c.target.sourceKind),
      overrideValues: c.overrideValues,
      status: "active",
      provenance: { kind: c.target.sourceKind === "workspace-local-asset" ? "derived-from-workspace-local-asset" : c.target.sourceKind === "user-library-linked-asset" ? "customized-linked-user-library-asset" : c.target.sourceKind === "user-library-copied-asset" ? "customized-detached-user-library-copy" : c.target.sourceKind === "workspace-imported-asset" ? "customized-workspace-import" : c.target.sourceKind === "system-owned-asset" ? "system-derived-override" : "edited-authored-asset", targetWorkspaceId: c.targetWorkspaceId, sourceWorkspaceId: found.sourceWorkspaceId, operationAt: at },
      createdAt: at,
      updatedAt: at,
    });
    return { kind: "success", value: await this.d.assetOverrideRepository.saveAssetOverrideRecord(record) };
  } catch { return fail("validation", "Create asset override command is invalid."); }}
}
