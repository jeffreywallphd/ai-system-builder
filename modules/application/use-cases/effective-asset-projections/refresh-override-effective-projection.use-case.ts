import { normalizeRefreshEffectiveAssetProjectionCommand, type RefreshEffectiveAssetProjectionCommand, type RefreshEffectiveAssetProjectionResult } from "../../../contracts/effective-asset-projections";
import type { AssetCustomizationTargetReaderPort, AssetOverrideRepositoryPort } from "../../ports/asset-authoring";
import type { EffectiveAssetProjectionRepositoryPort } from "../../ports/effective-asset-projections";
import { mapEditableToProjectedFields } from "./effective-asset-projection-field-mapper.service";
import { createProjectionProvenance } from "./effective-asset-projection-provenance.service";
import { projectionFailure } from "./effective-asset-projection-result-helpers";
import { deriveOverrideProjectionStatus } from "./effective-asset-override-projection-status.service";

const SUPPORTED = new Set(["workspace-customized","linked-with-workspace-override","copied-with-workspace-override","imported-with-workspace-override","system-derived-override"]);

export class RefreshOverrideEffectiveProjectionUseCase {
  constructor(private readonly d:{projectionRepository:EffectiveAssetProjectionRepositoryPort;assetOverrideRepository:AssetOverrideRepositoryPort;targetReader:AssetCustomizationTargetReaderPort;now?:()=>string;}){}
  async execute(command:RefreshEffectiveAssetProjectionCommand):Promise<RefreshEffectiveAssetProjectionResult>{
    let c; try{c=normalizeRefreshEffectiveAssetProjectionCommand(command);}catch{return projectionFailure("validation","effective-projection-workspace-required");}
    const existing=await this.d.projectionRepository.readEffectiveAssetProjectionRecord(c.targetWorkspaceId,c.projectionId); if(!existing) return projectionFailure("not-found","effective-projection-source-missing");
    if(!SUPPORTED.has(existing.sourceKind)) return projectionFailure("unsupported","effective-projection-source-unsupported");
    const now=(this.d.now??(()=>new Date().toISOString()))();
    const overrideId = existing.source.overrideId; if(!overrideId) return projectionFailure("validation","effective-projection-source-required");
    const o=await this.d.assetOverrideRepository.readAssetOverrideRecord(c.targetWorkspaceId, overrideId);
    if(!o){const upd={...existing,status:"source-missing" as const,policy:"blocked" as const,projectedFields:{},diagnostics:[{code:"effective-projection-source-missing",message:"Sanitized projection diagnostic."}],blockers:[{code:"effective-projection-source-missing",message:"Sanitized projection blocker."}],updatedAt:now,materializedAt:now}; await this.d.projectionRepository.updateEffectiveAssetProjectionRecord(upd); return {status:"success",value:upd};}
    const target=await this.d.targetReader.readCustomizationTargetByReference(c.targetWorkspaceId,existing.target.effectiveAssetReference);
    if(!target){const upd={...existing,status:"source-missing" as const,policy:"blocked" as const,projectedFields:{},diagnostics:[{code:"effective-projection-source-missing",message:"Sanitized projection diagnostic."}],blockers:[{code:"effective-projection-source-missing",message:"Sanitized projection blocker."}],updatedAt:now,materializedAt:now}; await this.d.projectionRepository.updateEffectiveAssetProjectionRecord(upd); return {status:"success",value:upd};}
    const statusModel=deriveOverrideProjectionStatus(o);
    const mapped = statusModel.status === "ready" ? mapEditableToProjectedFields(o.overrideValues) : {projectedFields:{},diagnostics:[],blockers:[],blocked:false};
    const status = mapped.blocked?"blocked":statusModel.status;
    const upd={...existing,status,policy:(status==="ready"&&!mapped.blocked)?"safe-fields-only":"blocked",projectedFields:(status==="ready"&&!mapped.blocked)?mapped.projectedFields:{},diagnostics:statusModel.diagnosticCode?[{code:statusModel.diagnosticCode,message:"Sanitized projection diagnostic."}]:mapped.diagnostics,blockers:statusModel.diagnosticCode?[{code:statusModel.diagnosticCode,message:"Sanitized projection blocker."}]:mapped.blockers,provenance:createProjectionProvenance(c.targetWorkspaceId,existing.source,now),updatedAt:now,materializedAt:now};
    
