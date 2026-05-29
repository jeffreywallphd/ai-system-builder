import { readFileSync } from 'node:fs';
import { describe, expect, it } from '../../testing/node-test';

const read = (p:string)=>readFileSync(p,'utf8');

describe('execution plan phase 12 docs closeout', ()=>{
  it('routes and indexes execution plan pack', ()=>{
    const index = read('docs/context/packs/index.pack.md');
    const routing = read('docs/context/prompt-routing.md');
    expect(index).toContain('execution-plan-preparation.pack.md');
    expect(routing).toContain('execution-plan-preparation.pack.md');
  });

  it('keeps phase 12 explicitly non-executing and preview-in-setup language', ()=>{
    const arch = read('docs/architecture/execution-plan-preparation.md');
    const adr = read('docs/adr/ADR-0022-execution-plan-preparation.md');
    const pack = read('docs/context/packs/execution-plan-preparation.pack.md');
    expect(arch).toContain('Phase 12 does not execute');
    expect(arch).toContain('Assets / Plans / Setup');
    expect(arch).toContain('ready-for-review');
    expect(arch).toContain('does **not** mean executable');
    expect(arch).toContain('does **not** mean ready-to-run');
    expect(adr).toContain('do not execute workflows');
    expect(pack).toContain('Planning layer only; no execution.');
  });

  it('does not overclaim execution outcomes', ()=>{
    const docs = [
      read('docs/architecture/execution-plan-preparation.md'),
      read('docs/adr/ADR-0022-execution-plan-preparation.md'),
      read('docs/context/packs/execution-plan-preparation.pack.md')
    ].join('\n');
    for (const banned of ['execution-ready','runtime-ready','workflow-ready']) {
      expect(docs.toLowerCase()).not.toContain(banned);
    }
  });
});
