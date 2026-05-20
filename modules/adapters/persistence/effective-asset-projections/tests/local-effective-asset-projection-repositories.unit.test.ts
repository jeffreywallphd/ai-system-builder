import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { normalizeAssetId } from "../../../../contracts/asset";
import { createWorkspaceId } from "../../../../contracts/workspace";
import { createEffectiveAssetProjectionId, createEffectiveAssetProjectionSnapshotId } from "../../../../contracts/effective-asset-projections";
import { createLocalEffectiveAssetProjectionRepositoryAdapter, createLocalEffectiveAssetProjectionSnapshotRepositoryAdapter, LocalEffectiveAssetProjectionRecordStoreError } from "..";
const wsA=createWorkspaceId("workspace.a"), wsB=createWorkspaceId("workspace.b");
const base={source:{sourceKind:"workspace-local",targetWorkspaceId:wsA},target:{targetWorkspaceId:wsA,effectiveAssetReference:{kind:"asset-definition-version",id:normalizeAssetId("effective.a"),version:"1.0.0"},intendedPolicy:"manual-refresh"},sourceKind:"workspace-local",status:"ready",policy:"manual-refresh",projectedFields:{displayName:"A",summary:"s"},diagnostics:[],blockers:[],provenance:{kind:"projection",sourceKind:"workspace-local",targetWorkspaceId:wsA,operationAt:"2026-05-20T00:00:00.000Z"},effectiveAssetReference:{kind:"asset-definition-version",id:normalizeAssetId("effective.a"),version:"1.0.0"},createdAt:"2026-05-20T00:00:00.000Z",updatedAt:"2026-05-20T00:00:00.000Z"} as const;

describe("local effective asset projection persistence",()=>{
 it("saves, reads, filters, and isolates by workspace", async()=>{
  const rootDir=await mkdtemp(join(tmpdir(),"eap-")); const repo=createLocalEffectiveAssetProjectionRepositoryAdapter({rootDir});
  const a={...base,projectionId:createEffectiveAssetProjectionId("projection.a")};
  const b={...base,projectionId:createEffectiveAssetProjectionId("projection.b"),targetWorkspaceId:wsB,source:{...base.source,targetWorkspaceId:wsB},target:{...base.target,targetWorkspaceId:wsB},effectiveAssetReference:{...base.effectiveAssetReference,id:normalizeAssetId("effective.b")},updatedAt:"2026-05-20T01:00:00.000Z"};
  await repo.saveEffectiveAssetProjectionRecord(a); await repo.saveEffectiveAssetProjectionRecord(b as any);
  assert.equal((await repo.readEffectiveAssetProjectionRecord(wsA,a.projectionId))?.projectionId,a.projectionId);
  assert.equal((await repo.listEffectiveAssetProjectionRecords({targetWorkspaceId:wsA})).records.length,1);
  assert.equal((await repo.readEffectiveAssetProjectionRecordByEffectiveAssetReference(wsA,a.effectiveAssetReference))?.projectionId,a.projectionId);
 });
 it("fails safely on manifest mismatch", async()=>{const rootDir=await mkdtemp(join(tmpdir(),"eap-")); const repo=createLocalEffectiveAssetProjectionRepositoryAdapter({rootDir}); await repo.listEffectiveAssetProjectionRecords({targetWorkspaceId:wsA}); const manifestPath=join(rootDir,"effective-asset-projections","effective-asset-projection-manifest.json"); const manifest=JSON.parse(await readFile(manifestPath,"utf8")); manifest.schemaVersion=99; await writeFile(manifestPath,JSON.stringify(manifest)); await assert.rejects(()=>repo.listEffectiveAssetProjectionRecords({targetWorkspaceId:wsA}),LocalEffectiveAssetProjectionRecordStoreError);});
 it("supports snapshots scoped by workspace", async()=>{const rootDir=await mkdtemp(join(tmpdir(),"eap-")); const repo=createLocalEffectiveAssetProjectionSnapshotRepositoryAdapter({rootDir}); const snap={...base,projectionId:createEffectiveAssetProjectionId("projection.a"),projectionSnapshotId:createEffectiveAssetProjectionSnapshotId("snapshot.a")}; await repo.saveEffectiveAssetProjectionSnapshotRecord(snap as any); assert.equal((await repo.readEffectiveAssetProjectionSnapshotRecord(wsA,snap.projectionSnapshotId))?.projectionSnapshotId,snap.projectionSnapshotId); assert.equal((await repo.listEffectiveAssetProjectionSnapshotRecords({targetWorkspaceId:wsB})).records.length,0);});
});
