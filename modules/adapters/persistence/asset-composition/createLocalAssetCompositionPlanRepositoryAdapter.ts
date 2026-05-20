import type { AssetCompositionPlanRepositoryPort } from "../../../application/ports/asset-composition";
import { normalizeAssetCompositionPlan, normalizeAssetCompositionPlanId, normalizeAssetCompositionNodeRole, normalizeAssetCompositionRelationshipKind, normalizeAssetCompositionCompatibilityStatus, normalizeAssetCompositionPlanStatus, type AssetCompositionPlan } from "../../../contracts/asset-composition";
import type { AssetReference } from "../../../contracts/asset";
import { normalizeEffectiveAssetProjectionId } from "../../../contracts/effective-asset-projections";
import { pageRecords, textValuesMatch } from "../user-library/local-user-library-repository-helpers";
import { LocalAssetCompositionPlanRecordStore } from "./local-asset-composition-plan-record-store";

const sort = (a:AssetCompositionPlan,b:AssetCompositionPlan)=>b.updatedAt.localeCompare(a.updatedAt)||a.planId.localeCompare(b.planId);
const hasRef = (a?: AssetReference, b?: AssetReference)=>Boolean(a&&b&&a.kind===b.kind&&a.id===b.id&&a.version===b.version);

export function createLocalAssetCompositionPlanRepositoryAdapter(o:{rootDir:string; now?:()=>string}): AssetCompositionPlanRepositoryPort {
  const store = new LocalAssetCompositionPlanRecordStore(o);
  return {
    async saveAssetCompositionPlanRecord(record){ const n = normalizeAssetCompositionPlan(record); const all = [ ...(await store.readPlans<AssetCompositionPlan>()).filter((x)=>!(x.targetWorkspaceId===n.targetWorkspaceId&&x.planId===n.planId)), n ].sort(sort); await store.writePlans(all); return n; },
    async updateAssetCompositionPlanRecord(record){ return this.saveAssetCompositionPlanRecord(record); },
    async readAssetCompositionPlanRecord(targetWorkspaceId, planId){ const safePlanId = normalizeAssetCompositionPlanId(planId); return (await store.readPlans<AssetCompositionPlan>()).map(normalizeAssetCompositionPlan).find((x)=>x.targetWorkspaceId===targetWorkspaceId&&x.planId===safePlanId); },
    async listAssetCompositionPlanRecords(query){
      if (!query.targetWorkspaceId) throw new Error("targetWorkspaceId is required.");
      const safeProjectionId = query.selectedProjectionId ? normalizeEffectiveAssetProjectionId(query.selectedProjectionId) : undefined;
      const plans = (await store.readPlans<AssetCompositionPlan>()).map(normalizeAssetCompositionPlan).filter((x)=>x.targetWorkspaceId===query.targetWorkspaceId
        && (!query.status || x.status===normalizeAssetCompositionPlanStatus(query.status))
        && (!safeProjectionId || x.selectedProjections.some((p)=>p.projectionId===safeProjectionId))
        && (!query.effectiveAssetReference || x.nodes.some((n)=>hasRef(n.effectiveAssetReference, query.effectiveAssetReference)))
        && (!query.nodeRole || x.nodes.some((n)=>n.role===normalizeAssetCompositionNodeRole(query.nodeRole)))
        && (!query.relationshipKind || x.relationships.some((r)=>r.kind===normalizeAssetCompositionRelationshipKind(query.relationshipKind)))
        && (!query.compatibilityStatus || x.relationships.some((r)=>r.compatibilityStatus===normalizeAssetCompositionCompatibilityStatus(query.compatibilityStatus)))
        && (!query.blockedOnly || x.blockers.length>0)
        && (!query.conflictedOnly || x.status==="conflicted")
        && (!query.staleOnly || x.status==="stale")
        && (query.archived===undefined || (query.archived ? Boolean(x.archivedAt) : !x.archivedAt))
        && (!query.createdAfter || x.createdAt >= query.createdAfter)
        && (!query.createdBefore || x.createdAt <= query.createdBefore)
        && (!query.updatedAfter || x.updatedAt >= query.updatedAfter)
        && (!query.updatedBefore || x.updatedAt <= query.updatedBefore)
        && textValuesMatch([x.name, x.description], query.text));
      const paged = pageRecords(plans.sort(sort), query.limit, query.cursor);
      return { records: paged.records, nextCursor: paged.nextCursor };
    },
    async listActiveDraftBlockedConflictedStaleOrArchivedAssetCompositionPlanRecords(targetWorkspaceId){ return (await this.listAssetCompositionPlanRecords({ targetWorkspaceId })).records.filter((x)=>x.status==="active"||x.status==="draft"||x.status==="blocked"||x.status==="conflicted"||x.status==="stale"||Boolean(x.archivedAt)); },
    async listAssetCompositionPlanRecordsBySelectedProjectionId(targetWorkspaceId, selectedProjectionId){ return (await this.listAssetCompositionPlanRecords({ targetWorkspaceId, selectedProjectionId })).records; },
    async listAssetCompositionPlanRecordsByEffectiveAssetReference(targetWorkspaceId, effectiveAssetReference){ return (await this.listAssetCompositionPlanRecords({ targetWorkspaceId, effectiveAssetReference })).records; },
    async archiveAssetCompositionPlanRecord(targetWorkspaceId, planId, archivedAt){ const plan = await this.readAssetCompositionPlanRecord(targetWorkspaceId, planId); if (!plan) return undefined; return this.saveAssetCompositionPlanRecord({ ...plan, status: "archived", archivedAt, updatedAt: archivedAt }); }
  };
}
