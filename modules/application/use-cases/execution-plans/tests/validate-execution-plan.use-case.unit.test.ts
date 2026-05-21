import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidateExecutionPlanUseCase } from '../validate-execution-plan.use-case';
import { ExecutionPlanPreflightValidationService } from '../execution-plan-preflight-validation.service';
import { ExecutionPlanSafetyGateValidationService } from '../execution-plan-safety-gate-validation.service';
import { ExecutionPlanResourceEstimateService } from '../execution-plan-resource-estimate.service';
import { ExecutionPlanStatusService } from '../execution-plan-status.service';

const record:any = { id:'ep_1', workspaceId:'ws_1', sourceCompositionPlanId:'acp_1', sourceRuntimeReadinessBindingId:'rrb_1', sourceReadinessStatus:'ready-for-setup', status:'draft', steps:[{id:'es_1',sourceCompositionPlanId:'acp_1',kind:'generate-text',status:'planned',label:'s',summary:'safe',requiredAdapterReferenceIds:[],inputIds:[],outputIds:[],dependencyIds:[],safetyGateIds:[],blockers:[],diagnostics:[]}], dependencies:[], inputs:[], outputs:[], adapterReferences:[], safetyGates:[{id:'g1',kind:'user-review-required',status:'planned',label:'g',blockers:[],diagnostics:[]}], blockers:[], diagnostics:[], resourceEstimates:[], provenance:[], createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z' };

test('validate use case saves and returns success', async ()=>{
 const repo:any={getExecutionPlanById:async()=>record, updateExecutionPlan:async(v:any)=>v};
 const uc = new ValidateExecutionPlanUseCase({executionPlanRepository:repo, preflightValidationService:new ExecutionPlanPreflightValidationService(), safetyGateValidationService:new ExecutionPlanSafetyGateValidationService(), resourceEstimateService:new ExecutionPlanResourceEstimateService(), statusService:new ExecutionPlanStatusService(), now:()=> '2026-05-21T00:00:00.000Z'});
 const r:any = await uc.execute({workspaceId:'ws_1',executionPlanId:'ep_1'});
 assert.equal(r.kind,'success');
 assert.equal(r.value.status,'safety-review-required');
});
