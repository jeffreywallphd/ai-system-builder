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
  type CreateAssetDraftCommand,
  type CreateAssetDraftResult,
  type CreateWorkspaceAuthoredAssetCommand,
  type CreateWorkspaceAuthoredAssetResult,
  type PublishAssetDraftCommand,
  type PublishAssetDraftResult,
  type UpdateAssetDraftCommand,
  type UpdateAssetDraftResult,
} from "../../../contracts/asset-authoring";
import { fail } from "./asset-authoring-use-case-results";
import { createAuthoredFromScratchProvenance, createEditedAuthoredAssetProvenance, createRevisedAuthoredAssetProvenance } from "./asset-authoring-provenance.service";
import { createPublishedRevisionFromDraft, normalizeGeneratedRevisionId } from "./asset-authoring-versioning.service";
import { expectedBaseRevisionMatches } from "./asset-authoring-conflict.service";
import type { AssetDraftRepositoryPort, AssetRevisionRepositoryPort, AuthoredAssetRepositoryPort } from "../../ports/asset-authoring";

const nowIso = () => new Date().toISOString();

export interface CreateWorkspaceAuthoredAssetUseCaseDependencies { authoredAssetRepository: AuthoredAssetRepositoryPort; assetRevisionRepository: AssetRevisionRepositoryPort; now?: () => string; generateAuthoredAssetId: () => string; generateAssetRevisionId: () => string; }
export class CreateWorkspaceAuthoredAssetUseCase {
  public constructor(private readonly d: CreateWorkspaceAuthoredAssetUseCaseDependencies) {}
  public async execute(command: CreateWorkspaceAuthoredAssetCommand): Promise<CreateWorkspaceAuthoredAssetResult> { try {
    const c = normalizeCreateWorkspaceAuthoredAssetCommand(command); if (c.baseTarget) return fail("unsupported", "Derived/base-target authored asset creation is deferred.");
    const at = (this.d.now ?? nowIso)();
    let authoredAssetId: ReturnType<typeof normalizeAuthoredAssetId>; let revisionId: ReturnType<typeof normalizeAssetRevisionId>;
    try { authoredAssetId = normalizeAuthoredAssetId(this.d.generateAuthoredAssetId()); revisionId = normalizeAssetRevisionId(this.d.generateAssetRevisionId()); } catch { return fail("internal", "Generated identifier is invalid."); }
    const authored = normalizeAuthoredAssetRecord({ authoredAssetId, workspaceId: c.workspaceId, assetReference: { kind: "asset-instance", id: authoredAssetId as any, version: "1.0.0", label: c.initialEditableValues["display-name"] as string | undefined }, currentRevisionId: revisionId, status: "draft", editableValues: normalizeSafeAssetEditableFieldPatch(c.initialEditableValues), provenance: createAuthoredFromScratchProvenance(c.workspaceId, at), createdAt: at, updatedAt: at });
    const revision = normalizeAuthoredAssetRevisionRecord({ revisionId, workspaceId: c.workspaceId, authoredAssetId, revision: "1", status: "published", editableValues: authored.editableValues, provenance: createRevisedAuthoredAssetProvenance(c.workspaceId, at), createdAt: at, updatedAt: at, publishedAt: at });
    await this.d.authoredAssetRepository.saveAuthoredAssetRecord(authored); await this.d.assetRevisionRepository.saveAssetRevisionRecord(revision);
    return { kind: "success", value: authored };
  } catch { return fail("validation", "Create workspace authored asset command is invalid."); }}
}

export interface CreateAssetDraftUseCaseDependencies { assetDraftRepository: AssetDraftRepositoryPort; now?:()=>string; generateAssetDraftId:()=>string; }
export class CreateAssetDraftUseCase { constructor(private readonly d:CreateAssetDraftUseCaseDependencies){}
async execute(command:CreateAssetDraftCommand):Promise<CreateAssetDraftResult>{ try{ const c=normalizeCreateAssetDraftCommand(command); if(c.baseTarget) return fail("unsupported","Draft base-target creation is deferred."); const at=(this.d.now??nowIso)(); const draft=normalizeAuthoredAssetDraftRecord({draftId:normalizeAssetDraftId(this.d.generateAssetDraftId()),targetWorkspaceId:c.targetWorkspaceId,draftEditableValues:c.draftEditableValues,status:"draft",provenance:createAuthoredFromScratchProvenance(c.targetWorkspaceId,at),createdAt:at,updatedAt:at}); const saved=await this.d.assetDraftRepository.saveAssetDraftRecord(draft); return {kind:"success",value:saved}; }catch{return fail("validation","Create asset draft command is invalid.");}}
}

export interface UpdateAssetDraftUseCaseDependencies { assetDraftRepository: AssetDraftRepositoryPort; now?:()=>string; }
export class UpdateAssetDraftUseCase { constructor(private readonly d:UpdateAssetDraftUseCaseDependencies){}
async execute(command:UpdateAssetDraftCommand):Promise<UpdateAssetDraftResult>{ try{ const c=normalizeUpdateAssetDraftCommand(command); const found=await this.d.assetDraftRepository.readAssetDraftRecord(c.targetWorkspaceId,c.draftId); if(!found) return fail("not-found","Asset draft was not found."); if(found.status!=="draft") return fail("conflict","Draft status is not editable."); const updated=normalizeAuthoredAssetDraftRecord({...found,draftEditableValues:{...found.draftEditableValues,...c.draftEditablePatch},updatedAt:(this.d.now??nowIso)(),provenance:found.provenance}); const saved=await this.d.assetDraftRepository.updateAssetDraftRecord(updated); return {kind:"success",value:saved}; }catch{return fail("validation","Update asset draft command is invalid.");}}
}

export interface PublishAssetDraftUseCaseDependencies { assetDraftRepository: AssetDraftRepositoryPort; authoredAssetRepository: AuthoredAssetRepositoryPort; assetRevisionRepository: AssetRevisionRepositoryPort; now?:()=>string; generateAuthoredAssetId:()=>string; generateAssetRevisionId:()=>string; }
export class PublishAssetDraftUseCase { constructor(private readonly d:PublishAssetDraftUseCaseDependencies){}
async execute(command:PublishAssetDraftCommand):Promise<PublishAssetDraftResult>{ try{ const c=normalizePublishAssetDraftCommand(command); const draft=await this.d.assetDraftRepository.readAssetDraftRecord(c.targetWorkspaceId,c.draftId); if(!draft) return fail("not-found","Asset draft was not found."); if(draft.status!=="draft") return fail("conflict","Draft status is not publishable."); const at=(this.d.now??nowIso)(); const authoredAssetId=normalizeAuthoredAssetId(this.d.generateAuthoredAssetId()); const normalizedRevision=normalizeGeneratedRevisionId(this.d.generateAssetRevisionId); if(normalizedRevision.kind==="failure") return normalizedRevision; const revisionResult=createPublishedRevisionFromDraft({draft,revisionId:normalizedRevision.value,authoredAssetId,now:at,revisionLabel:"1"}); if(revisionResult.kind==="failure") return revisionResult; const revision=revisionResult.value; if(!expectedBaseRevisionMatches(c.expectedBaseRevision,draft.baseAssetReference?draft.baseAssetReference.version:undefined)) return fail("conflict","Expected base revision does not match known draft base revision."); const authored=normalizeAuthoredAssetRecord({authoredAssetId,workspaceId:c.targetWorkspaceId,assetReference:{kind:"asset-instance",id:authoredAssetId as any,version:"1.0.0"},currentRevisionId:revision.revisionId,status:"published",editableValues:draft.draftEditableValues,provenance:createEditedAuthoredAssetProvenance(c.targetWorkspaceId,at),createdAt:at,updatedAt:at}); const savedRev=await this.d.assetRevisionRepository.saveAssetRevisionRecord(revision); await this.d.authoredAssetRepository.saveAuthoredAssetRecord(authored); await this.d.assetDraftRepository.updateAssetDraftRecord(normalizeAuthoredAssetDraftRecord({...draft,status:"published",updatedAt:at})); return {kind:"success",value:savedRev}; }catch{return fail("validation","Publish asset draft command is invalid.");}}
}
