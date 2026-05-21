import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateExecutionPlanUseCase } from '../create-execution-plan.use-case';
import { ExecutionPlanStepPlanningService } from '../execution-plan-step-planning.service';
import { ExecutionPlanStatusService } from '../execution-plan-status.service';

const readiness = { readinessBindingId:'rrb_1', targetWorkspaceId:'workspace.demo', compositionPlanId:'acp_1', status:'ready-for-setup', requirements:[], providerCandidates:[], bindingCandidates:[], bindings:[], blockers:[], diagnostics:[], provenance:[], createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z' } as any;
const composition = { planId:'acp_1', targetWorkspaceId:'workspace.demo', name:'plan', status:'valid', selectedProjections:[], nodes:[{ nodeId:'node_1', targetWorkspaceId:'workspace.demo', selectedProjection:{targetWorkspaceId:'workspace.demo', projectionId:'eap_1'}, role:'generator', status:'planned', requiredCapabilities:[{capabilityKind:'image-generation', capabilityKey:'img'}], providedCapabilities:[], diagnostics:[], blockers:[], label:'Image', createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z' }], relationships:[], compatibilityDiagnostics:[], blockers:[], planningSummary:{totalNodes:1,compatibleNodeCount:1,blockedNodeCount:0,conflictedNodeCount:0,missingDependencyCount:0,staleProjectionCount:0,unsupportedCount:0,totalRelationships:0,compatibleRelationshipCount:0,blockedRelationshipCount:0,planningReadiness:'ready'}, provenance:[], createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z' } as any;

test('creates execution plan from readiness binding', async () => {
  let saved:any;
  const useCase = new CreateExecutionPlanUseCase({
    executionPlanRepository: { saveExecutionPlan: async (r:any)=> (saved=r,r), updateExecutionPlan: async()=>{throw new Error('x');}, getExecutionPlanById: async()=>undefined, listExecutionPlans: async()=>({plans:[]}), archiveExecutionPlan: async()=>undefined },
    runtimeReadinessBindingRepository: { readRuntimeReadinessBindingRecord: async()=>readiness } as any,
    compositionPlanRepository: { readAssetCompositionPlanRecord: async()=>composition } as any,
    stepPlanningService: new ExecutionPlanStepPlanningService(),
    statusService: new ExecutionPlanStatusService(),
    nextExecutionPlanId: ()=> 'ep_1',
    nextExecutionStepId: ()=> 'es_1',
    now: ()=> '2026-01-02T00:00:00.000Z',
  });
  const result = await useCase.execute({ workspaceId:'workspace.demo', runtimeReadinessBindingId:'rrb_1' });
  assert.equal(result.kind, 'success');
  assert.equal(saved.sourceRuntimeReadinessBindingId, 'rrb_1');
  assert.equal(saved.status, 'ready-for-review');
});

test('missing workspace id fails validation', async () => {
  const useCase = new CreateExecutionPlanUseCase({ executionPlanRepository: {} as any, runtimeReadinessBindingRepository: {} as any, compositionPlanRepository: {} as any, stepPlanningService: new ExecutionPlanStepPlanningService(), statusService: new ExecutionPlanStatusService(), nextExecutionPlanId: ()=> 'ep_1', nextExecutionStepId: ()=> 'es_1' });
  const result = await useCase.execute({ workspaceId:'', runtimeReadinessBindingId:'rrb_1' } as any);
  assert.equal(result.kind, 'failure');
});
