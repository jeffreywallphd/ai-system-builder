import { mkdtemp } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalExecutionRunRepositoryAdapters } from '..';

describe('local execution-runs repositories',()=>{it('saves and reads by workspace', async()=>{const root=await mkdtemp(join(tmpdir(),'exec-runs-')); const a=createLocalExecutionRunRepositoryAdapters({rootDir:root}); await a.executionRunRepository.saveExecutionRun({id:'run-1',workspaceId:'ws-1',sourceExecutionPlanId:'plan-1',status:'queued',attemptIds:[],eventIds:[],resultIds:[],blockers:[],diagnostics:[],provenance:[],createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'} as any); expect(await a.executionRunRepository.getExecutionRunById('ws-1','run-1' as any)).toBeTruthy(); expect(await a.executionRunRepository.getExecutionRunById('ws-2','run-1' as any)).toBeUndefined();});});
