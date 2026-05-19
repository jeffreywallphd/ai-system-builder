import {
  normalizeAssetRevisionId,
  normalizeAuthoredAssetId,
  normalizeAssetDraftId,
  normalizeCreateAssetDraftCommand,
  normalizeCreateWorkspaceAuthoredAssetCommand,
  normalizePublishAssetDraftCommand,
  normalizeUpdateAssetDraftCommand,
  normalizeSafeAssetEditableFieldPatch,
  normalizeAuthoredAssetDraftRecord,
  normalizeAuthoredAssetRecord,
  normalizeAuthoredAssetRevisionRecord,
  type AssetAuthoringFailure,
  type CreateAssetDraftCommand,
  type CreateAssetDraftResult,
  type CreateWorkspaceAuthoredAssetCommand,
  type CreateWorkspaceAuthoredAssetResult,
  type PublishAssetDraftCommand,
  type PublishAssetDraftResult,
  type UpdateAssetDraftCommand,
  type UpdateAssetDraftResult,
} from "../../../contracts/asset-authoring";
import type { AssetDraftRepositoryPort, AssetRevisionRepositoryPort, AuthoredAssetRepositoryPort } from "../../ports/asset-authoring";

const nowIso = () => new Date().toISOString();
const fail = <T>(code: AssetAuthoringFailure["code"], message: string): { kind: "failure"; failure: AssetAuthoringFailure } => ({ kind: "failure", failure: { code, message } });

export interface CreateWorkspaceAuthoredAssetUseCaseDependencies { authoredAssetRepository: AuthoredAssetRepositoryPort; assetRevisionRepository: AssetRevisionRepositoryPort; now?: () => string; generateAuthoredAssetId: () => string; generateAssetRevisionId: () => string; }
export class CreateWorkspaceAuthoredAssetUseCase {
  public constructor(private readonly d: CreateWorkspaceAuthoredAssetUseCaseDependencies) {}
  public async execute(command: CreateWorkspaceAuthoredAssetCommand): Promise<CreateWorkspaceAuthoredAssetResult> { try {
    const c = normalizeCreateWorkspaceAuthoredAssetCommand(command); if (c.baseTarget) return fail("unsupported", "Derived/base-target authored asset creation is deferred.");
    const at = (this.d.now ?? nowIso)();
    let authoredAssetId: ReturnType<typeof normalizeAuthoredAssetId>; let revisionId: ReturnType<typeof normalizeAssetRevisionId>;
    try { authoredAssetId = normalizeAuthoredAssetId(this.d.generateAuthoredAssetId()); revisionId = normalizeAssetRevisionId(this.d.generateAssetRevisionId()); } catch { return fail("internal", "Generated identifier is invalid."); }
    const authored = normalizeAuthoredAssetRecord({ authoredAssetId, workspaceId: c.workspaceId, assetReference: { kind: "asset-reference", assetId: authoredAssetId, version: "1.0.0", label: c.initialEditableValues["display-name"] as string | undefined }, currentRevisionId: revisionId, status: "active", editableValues: normalizeSafeAssetEditableFieldPatch(c.initialEditableValues), provenance: { kind: "authored-from-scratch", targetWorkspaceId: c.workspaceId, operationAt: at }, createdAt: at, updatedAt: at });
    const revision = normalizeAuthoredAssetRevisionRecord({ revisionId, workspaceId: c.workspaceId, authoredAssetId, revision: "1", status: "published", editableValues: authored.editableValues, provenance: { kind: "revised-authored-asset", targetWorkspaceId: c.workspaceId, operationAt: at }, createdAt: at, updatedAt: at, publishedAt: at });
    await this.d.authoredAssetRepository.saveAuthoredAssetRecord(authored); await this.d.assetRevisionRepository.saveAssetRevisionRecord(revision);
    return { kind: "success", value: authored };
  } catch { return fail("validation", "Create workspace authored asset command is invalid."); }}
}

export interface CreateAssetDraftUseCaseDependencies { assetDraftRepository: AssetDraftRepositoryPort; now?:()=>string; generateAssetDraftId:()=>string; }
export class CreateAssetDraftUseCase { constructor(private readonly d:CreateAssetDraftUseCaseDependencies){}
async execute(command:CreateAssetDraftCommand):Promise<CreateAssetDraftResult>{ try{ const c=normalizeCreateAssetDraftCommand(command); if(c.baseTarget) return fail("unsupported","Draft base-target creation is deferred."); const at=(this.d.now??nowIso)(); const draft=normalizeAuthoredAssetDraftRecord({draftId:normalizeAssetDraftId(this.d.generateAssetDraftId()),targetWorkspaceId:c.targetWorkspaceId,draftEditableValues:c.draftEditableValues,status:"draft",provenance:{kind:"authored-from-scratch",targetWorkspaceId:c.targetWorkspaceId,operationAt:at},createdAt:at,updatedAt:at}); const saved=await this.d.assetDraftRepository.saveAssetDraftRecord(draft); return {kind:"success",value:saved}; }catch{return fail("validation","Create asset draft command is invalid.");}}
}

export interface UpdateAssetDraftUseCaseDependencies { assetDraftRepository: AssetDraftRepositoryPort; now?:()=>string; }
export class UpdateAssetDraftUseCase { constructor(private readonly d:UpdateAssetDraftUseCaseDependencies){}
async execute(command:UpdateAssetDraftCommand):Promise<UpdateAssetDraftResult>{ try{ const c=normalizeUpdateAssetDraftCommand(command); const found=await this.d.assetDraftRepository.readAssetDraftRecord(c.targetWorkspaceId,c.draftId); if(!found) return fail("not-found","Asset draft was not found."); if(found.status!=="draft"&&found.status!=="active") return fail("conflict","Draft status is not editable."); const updated=normalizeAuthoredAssetDraftRecord({...found,draftEditableValues:{...found.draftEditableValues,...c.draftEditablePatch},updatedAt:(this.d.now??nowIso)(),provenance:found.provenance}); const saved=await this.d.assetDraftRepository.updateAssetDraftRecord(updated); return {kind:"success",value:saved}; }catch{return fail("validation","Update asset draft command is invalid.");}}
}

export interface PublishAssetDraftUseCaseDependencies { assetDraftRepository: AssetDraftRepositoryPort; authoredAssetRepository: AuthoredAssetRepositoryPort; assetRevisionRepository: AssetRevisionRepositoryPort; now?:()=>string; generateAuthoredAssetId:()=>string; generateAssetRevisionId:()=>string; }
export class PublishAssetDraftUseCase { constructor(private readonly d:PublishAssetDraftUseCaseDependencies){}
async execute(command:PublishAssetDraftCommand):Promise<PublishAssetDraftResult>{ try{ const c=normalizePublishAssetDraftCommand(command); const draft=await this.d.assetDraftRepository.readAssetDraftRecord(c.targetWorkspaceId,c.draftId); if(!draft) return fail("not-found","Asset draft was not found."); if(draft.status!=="draft"&&draft.status!=="active") return fail("conflict","Draft status is not publishable."); const at=(this.d.now??nowIso)(); const authoredAssetId=normalizeAuthoredAssetId(this.d.generateAuthoredAssetId()); const revisionId=normalizeAssetRevisionId(this.d.generateAssetRevisionId()); const authored=normalizeAuthoredAssetRecord({authoredAssetId,workspaceId:c.targetWorkspaceId,assetReference:{kind:"asset-reference",assetId:authoredAssetId,version:"1.0.0"},currentRevisionId:revisionId,status:"published",editableValues:draft.draftEditableValues,provenance:{kind:"edited-authored-asset",targetWorkspaceId:c.targetWorkspaceId,operationAt:at},createdAt:at,updatedAt:at}); const revision=normalizeAuthoredAssetRevisionRecord({revisionId,workspaceId:c.targetWorkspaceId,authoredAssetId,revision:"1",status:"published",editableValues:draft.draftEditableValues,provenance:{kind:"revised-authored-asset",targetWorkspaceId:c.targetWorkspaceId,operationAt:at},createdAt:at,updatedAt:at,publishedAt:at}); if(c.expectedBaseRevision && c.expectedBaseRevision!==revision.revision) return fail("conflict","Expected base revision does not match."); await this.d.authoredAssetRepository.saveAuthoredAssetRecord(authored); const savedRev=await this.d.assetRevisionRepository.saveAssetRevisionRecord(revision); await this.d.assetDraftRepository.updateAssetDraftRecord(normalizeAuthoredAssetDraftRecord({...draft,status:"published",updatedAt:at})); return {kind:"success",value:savedRev}; }catch{return fail("validation","Publish asset draft command is invalid.");}}
}
