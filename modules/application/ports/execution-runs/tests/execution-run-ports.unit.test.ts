import { describe, expectTypeOf, it } from 'vitest';
import type { ExecutionRunRepositoryPort } from '../execution-run-repository.port';

describe('execution-runs ports',()=>{it('declares execution run repository port',()=>{expectTypeOf<ExecutionRunRepositoryPort>().toBeObject();});});
