import { describe, expect, it } from 'vitest';
import { mapAvailableAssets, mapPlanDetail, mapPlanSummary } from './assetPlansViewModel';

describe('assetPlansViewModel desktop',()=>{
 it('maps labels and sanitizes',()=>{
  const s=mapPlanSummary({planId:'p1',name:'N',status:'valid',planningSummary:{totalNodes:2,totalRelationships:1,missingDependencyCount:3}});
  expect(s.statusLabel).toBe('Ready for planning');
  const d=mapPlanDetail({planId:'p1',status:'blocked',nodes:[{nodeId:'n1',status:'blocked',label:'Asset A',selectedProjection:{projectionId:'pr1'}}],relationships:[{relationshipId:'r1',sourceNodeId:'n1',targetNodeId:'n2',kind:'depends-on',compatibilityStatus:'missing-dependency'}],diagnostics:[{message:'env token path'}]});
  expect(d.nodes[0].statusLabel).toBe('Blocked');
  expect(d.relationships[0].statusLabel).toBe('Missing requirement');
  expect(d.messages[0]).not.toContain('token');
 });
 it('filters available assets by readiness',()=>{
  const options=mapAvailableAssets([{projectionId:'a',status:'ready',displayName:'A'},{projectionId:'b',status:'blocked',displayName:'B'}]);
  expect(options).toHaveLength(1);
  expect(options[0].id).toBe('a');
 });
});
