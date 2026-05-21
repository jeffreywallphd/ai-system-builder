import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createAssetCompositionPlanId } from "../../../../contracts/asset-composition";
import { createRuntimeReadinessBindingId, createWorkspaceId, type RuntimeInventory, type RuntimeReadinessBinding } from "../../../../contracts/runtime-readiness";
import { createLocalRuntimeInventoryRepositoryAdapter, createLocalRuntimeReadinessBindingRepositoryAdapter, LocalRuntimeReadinessRecordStoreError } from "..";
const wsA=createWorkspaceId("workspace.a"); const wsB=createWorkspaceId("workspace.b");
const binding=(ws:string,id:string):RuntimeReadinessBinding=>({readinessBindingId:createRuntimeReadinessBindingId(id),targetWorkspaceId:ws,compositionPlanId:createAssetCompositionPlanId("plan.a"),status:"blocked",requirements:[],providerCandidates:[],bindingCandidates:[],bindings:[],blockers:[],diagnostics:[],provenance:[],createdAt:"2026-05-20T00:00:00.000Z",updatedAt:"2026-05-20T00:00:00.000Z"});
const inventory=(ws:string,id:string):RuntimeInventory=>({targetWorkspaceId:ws,inventorySourceId:id as never,inventorySourceKind:"manual",discoveredProviderCandidates:[],discoveredCapabilities:[],inventoryStatus:"checked",diagnostics:[],blockers:[],checkedAt:"2026-05-20T00:00:00.000Z"});

describe("local runtime readiness repositories",()=>{
  it("saves reads and isolates readiness bindings", async()=>{const rootDir=await mkdtemp(join(tmpdir(),"rr-")); const repo=createLocalRuntimeReadinessBindingRepositoryAdapter({rootDir}); await repo.saveRuntimeReadinessBindingRecord(binding(wsA,"rb.1")); await repo.saveRuntimeReadinessBindingRecord(binding(wsB,"rb.1")); assert.equal((await repo.listRuntimeReadinessBindingRecords({targetWorkspaceId:wsA})).records.length,1); assert.equal((await repo.readRuntimeReadinessBindingRecord(wsB,createRuntimeReadinessBindingId("rb.1")))?.targetWorkspaceId,wsB);});
  it("saves reads and isolates inventory", async()=>{const rootDir=await mkdtemp(join(tmpdir(),"rr-")); const repo=createLocalRuntimeInventoryRepositoryAdapter({rootDir}); await repo.saveRuntimeInventoryRecord(inventory(wsA,"src.1")); await repo.saveRuntimeInventoryRecord(inventory(wsB,"src.1")); assert.equal((await repo.listRuntimeInventoryRecords({targetWorkspaceId:wsA})).records.length,1); assert.equal((await repo.readRuntimeInventoryRecord(wsB,"src.1" as never))?.targetWorkspaceId,wsB);});
  it("fails safely on manifest schema mismatch", async()=>{const rootDir=await mkdtemp(join(tmpdir(),"rr-")); const repo=createLocalRuntimeInventoryRepositoryAdapter({rootDir}); await repo.listRuntimeInventoryRecords({targetWorkspaceId:wsA}); const p=join(rootDir,"runtime-readiness","runtime-readiness-manifest.json"); const m=JSON.parse(await readFile(p,"utf8")); m.schemaVersion=99; await writeFile(p,JSON.stringify(m)); await assert.rejects(()=>repo.listRuntimeInventoryRecords({targetWorkspaceId:wsA}), LocalRuntimeReadinessRecordStoreError);});
});
