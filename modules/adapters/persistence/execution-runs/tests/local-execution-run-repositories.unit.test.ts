import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceId } from '../../../../contracts/workspace';
import { normalizeExecutionRunId } from '../../../../contracts/execution-runs';
import { createLocalExecutionRunRepositoryAdapters } from '../index';

const now='2026-01-01T00:00:00.000Z';
const wsA=createWorkspaceId('ws-a'); const wsB=createWorkspaceId('ws-b');
const runId=normalizeExecutionRunId('run-1');
const runBase={sourceExecutionPlanId:'plan-1',attemptIds:[],eventIds:[],resultIds:[],blockers:[],diagnostics:[],provenance:[],createdAt:now,updatedAt:now} as const;
async function setup(){const root=await mkdtemp(join(tmpdir(),'exec-')); return {root,a:createLocalExecutionRunRepositoryAdapters({rootDir:root,now:()=>now})};}

test('workspace isolation and shared-id non-overwrite for execution runs', async()=>{const {a}=await setup();
  await a.executionRunRepository.saveExecutionRun({id:runId,workspaceId:wsA,status:'failed',...runBase});
  await a.executionRunRepository.saveExecutionRun({id:runId,workspaceId:wsB,status:'retryable',...runBase});
  assert.equal((await a.executionRunRepository.getExecutionRunById(wsA,runId))?.workspaceId,wsA);
  assert.equal((await a.executionRunRepository.getExecutionRunById(wsB,runId))?.workspaceId,wsB);
});

test('retryable list is explicit and not inferred from failed/cancelled', async()=>{const {a}=await setup();
  await a.executionRunRepository.saveExecutionRun({id:normalizeExecutionRunId('run-f'),workspaceId:wsA,status:'failed',...runBase});
  await a.executionRunRepository.saveExecutionRun({id:normalizeExecutionRunId('run-c'),workspaceId:wsA,status:'cancelled',...runBase});
  await a.executionRunRepository.saveExecutionRun({id:normalizeExecutionRunId('run-r'),workspaceId:wsA,status:'retryable',...runBase});
  const retryable=await a.executionRunRepository.listRetryableExecutionRuns(wsA);
  assert.deepEqual(retryable.map(r=>r.id),['run-r']);
});

test('manifest/schema and malformed JSON failures surface', async()=>{const {root,a}=await setup();
  const dir=join(root,'execution-runs');
  await writeFile(join(dir,'execution-runs-manifest.json'),'{"schemaVersion":2,"storeKind":"execution-runs-local-store"}');
  await assert.rejects(()=>a.executionRunRepository.listExecutionRuns({workspaceId:wsA}));
  await writeFile(join(dir,'execution-runs-manifest.json'),'{"schemaVersion":1,"storeKind":"execution-runs-local-store"}');
  await writeFile(join(dir,'execution-runs.json'),'{broken-json');
  await assert.rejects(()=>a.executionRunRepository.listExecutionRuns({workspaceId:wsA}));
});
