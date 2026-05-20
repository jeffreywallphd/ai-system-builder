import test from "node:test";
import assert from "node:assert/strict";
import { CreateAuthoredAssetEffectiveProjectionUseCase, PreviewDraftEffectiveAssetProjectionUseCase, RefreshAuthoredAssetEffectiveProjectionUseCase, mapEditableToProjectedFields } from "../index";

const ws = "workspace.main" as any;

test("create authored projection ready", async ()=>{
  let saved:any;
  const uc = new CreateAuthoredAssetEffectiveProjectionUseCase({projectionRepository:{saveEffectiveAssetProjectionRecord:async(r:any)=>{saved=r;return r;},updateEffectiveAssetProjectionRecord:async(r:any)=>r,readEffectiveAssetProjectionRecord:async()=>undefined,readEffectiveAssetProjectionRecordByEffectiveAssetReference:async()=>undefined,listEffectiveAssetProjectionRecords:async()=>({records:[]}),listBlockedConflictedOrStaleEffectiveAssetProjectionRecords:async()=>[]},authoredAssetRepository:{readAuthoredAssetRecordByWorkspace:async()=>({status:"published",editableValues:{"display-name":"N"}} as any)} as any,assetRevisionRepository:{} as any,generateEffectiveAssetProjectionId:()=>"eap.main.1",now:()=>"2026-01-01T00:00:00.000Z"});
  const r=await uc.execute({targetWorkspaceId:ws,source:{sourceKind:"workspace-authored",targetWorkspaceId:ws,authoredAssetId:"authored.1" as any},target:{targetWorkspaceId:ws,effectiveAssetReference:{kind:"asset-instance",id:"a1"},intendedPolicy:"safe-fields-only"},policy:"safe-fields-only"} as any);
  assert.equal(r.status,"success"); assert.equal(saved.status,"ready"); assert.equal(saved.projectedFields["display-name"],"N");
});

test("refresh marks source missing", async ()=>{
  const uc = new RefreshAuthoredAssetEffectiveProjectionUseCase({projectionRepository:{readEffectiveAssetProjectionRecord:async()=>({projectionId:"eap.main.1",targetWorkspaceId:ws,source:{sourceKind:"workspace-authored",targetWorkspaceId:ws,authoredAssetId:"authored.1"},target:{targetWorkspaceId:ws,effectiveAssetReference:{kind:"asset-instance",id:"a1"},intendedPolicy:"safe-fields-only"},sourceKind:"workspace-authored",effectiveAssetReference:{kind:"asset-instance",id:"a1"},status:"ready",policy:"safe-fields-only",projectedFields:{},diagnostics:[],blockers:[],provenance:{targetWorkspaceId:ws,sourceKind:"workspace-authored",operationAt:"2026-01-01T00:00:00.000Z"},createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z"} as any),updateEffectiveAssetProjectionRecord:async(r:any)=>r} as any,authoredAssetRepository:{readAuthoredAssetRecordByWorkspace:async()=>undefined} as any,assetRevisionRepository:{} as any,now:()=>"2026-01-02T00:00:00.000Z"});
  const r=await uc.execute({targetWorkspaceId:ws,projectionId:"eap.main.1",reason:"source-missing"} as any);
  assert.equal(r.status,"success"); assert.equal((r as any).value.status,"source-missing");
});

test("preview draft returns draft-only", async ()=>{
const uc=new PreviewDraftEffectiveAssetProjectionUseCase({assetDraftRepository:{readAssetDraftRecord:async()=>({draftId:"draft.1",targetWorkspaceId:ws,draftEditableValues:{summary:"S"}})} as any,generateEffectiveAssetProjectionId:()=>"eap.main.2",now:()=>"2026-01-01T00:00:00.000Z"});
const r=await uc.execute({targetWorkspaceId:ws,source:{sourceKind:"workspace-authored-draft",targetWorkspaceId:ws,draftId:"draft.1",effectiveAssetReference:{kind:"asset-instance",id:"a1"}},policy:"draft-preview-only"} as any);
assert.equal(r.status,"success"); assert.equal((r as any).value.status,"draft-only"); assert.equal((r as any).value.policy,"draft-preview-only");
});

test("mapper keeps safe fields only", ()=>{ const r=mapEditableToProjectedFields({"display-name":"N","safe-metadata":{"ok":true}} as any); assert.equal(r.blocked,false); assert.equal(r.projectedFields["display-name"],"N"); });
