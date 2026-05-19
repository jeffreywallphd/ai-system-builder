import { normalizeAssetRevisionId, normalizeAuthoredAssetId, normalizeCreateWorkspaceAuthoredAssetCommand, normalizeSafeAssetEditableFieldPatch, normalizeAuthoredAssetRecord, type CreateWorkspaceAuthoredAssetCommand, type CreateWorkspaceAuthoredAssetResult } from "../../../contracts/asset-authoring";
import type { AuthoredAssetRepositoryPort } from "../../ports/asset-authoring";
import { fail } from "./asset-authoring-use-case-results";
import { createAuthoredFromScratchProvenance } from "./asset-authoring-provenance.service";

const nowIso = () => new Date().toISOString();
export interface CreateWorkspaceAuthoredAssetUseCaseDependencies { authoredAssetRepository: AuthoredAssetRepositoryPort; now?:()=>string; generateAuthoredAssetId:()=>string; generateAssetRevisionId:()=>string; }
export class CreateWorkspaceAuthoredAssetUseCase {
  constructor(private readonly d:CreateWorkspaceAuthoredAssetUseCaseDependencies){}
  async execute(command:CreateWorkspaceAuthoredAssetCommand):Promise<CreateWorkspaceAuthoredAssetResult>{
    let c; try { c=normalizeCreateWorkspaceAuthoredAssetCommand(command);} catch { return fail("validation","Create workspace authored asset command is invalid."); }
    if (c.baseTarget) return fail("unsupported","Derived/base-target authored asset creation is deferred.");
    const at=(this.d.now??nowIso)();
    let authoredAssetId; let currentRevisionId; try { authoredAssetId=normalizeAuthoredAssetId(this.d.generateAuthoredAssetId()); currentRevisionId=normalizeAssetRevisionId(this.d.generateAssetRevisionId()); } catch { return fail("internal","Generated identifier is invalid."); }
    const authored=normalizeAuthoredAssetRecord({authoredAssetId,workspaceId:c.workspaceId,assetReference:{kind:"asset-instance",id:authoredAssetId as never,version:"1.0.0",label:c.initialEditableValues["display-name"] as string|undefined},currentRevisionId,status:"draft",editableValues:normalizeSafeAssetEditableFieldPatch(c.initialEditableValues),provenance:createAuthoredFromScratchProvenance(c.workspaceId,at),createdAt:at,updatedAt:at});
    try { await this.d.authoredAssetRepository.saveAuthoredAssetRecord(authored);} catch { return fail("unavailable","Unable to persist authored asset record."); }
    return {kind:"success",value:authored};
  }
}
