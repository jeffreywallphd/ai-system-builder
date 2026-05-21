import { describe, expect, it, testDouble } from '../../../../testing/node-test';
import { registerExecutionPlansIpc } from '../execution-plans/registerExecutionPlansIpc';

describe('registerExecutionPlansIpc',()=>{
 it('registers channels and validates workspace', async()=>{
  const handlers=new Map<string, any>();
  registerExecutionPlansIpc({ ipcMain:{ handle:testDouble.fn((c,h)=>handlers.set(c,h)) } as any, executionPlans:{ create:{execute:testDouble.fn(async()=>({}))} as any, validate:{execute:testDouble.fn(async()=>({}))} as any, readModel:{ listExecutionPlanSummaries:testDouble.fn(async()=>({summaries:[]})), readExecutionPlanDetail:testDouble.fn(async()=>({})), listExecutionPlansForCompositionPlan:testDouble.fn(async()=>[]), readLatestExecutionPlanForCompositionPlan:testDouble.fn(async()=>undefined), listExecutionPlansForRuntimeReadinessBinding:testDouble.fn(async()=>[]), readLatestExecutionPlanForRuntimeReadinessBinding:testDouble.fn(async()=>undefined), listExecutionPlansNeedingAttention:testDouble.fn(async()=>[]), summarizeWorkspaceExecutionPlans:testDouble.fn(async()=>({total:0})) } as any } });
  expect(handlers.has('execution-plans:create-plan')).toBe(true);
  const res=await handlers.get('execution-plans:list-summaries')(null,{payload:{}});
  expect(res.ok).toBe(false);
  expect(res.error.code).toBe('validation');
 });
});
