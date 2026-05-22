import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from '../../testing/node-test';

const read = (p: string) => readFileSync(p, 'utf8');

describe('phase 13 controlled conversational execution docs closeout', () => {
  it('creates required phase 13 docs', () => {
    expect(existsSync('docs/architecture/controlled-conversational-system-execution.md')).toBe(true);
    expect(existsSync('docs/adr/ADR-0023-controlled-conversational-system-execution.md')).toBe(true);
    expect(existsSync('docs/context/packs/controlled-conversational-system-execution.pack.md')).toBe(true);
  });

  it('routes and indexes the phase 13 pack with transport split guidance', () => {
    const index = read('docs/context/packs/index.pack.md');
    const routing = read('docs/context/prompt-routing.md');
    expect(index).toContain('controlled-conversational-system-execution.pack.md');
    expect(routing).toContain('controlled-conversational-system-execution.pack.md');
    expect(routing).toContain('execution-plan-preparation.pack.md');
    expect(routing).toContain('runtime-readiness-binding.pack.md');
    expect(routing).toContain('asset-composition-planning.pack.md');
    expect(routing).toContain('do **not** combine API/server-host, IPC/preload/desktop-host, and desktop/thin-client client/parity');
  });

  it('documents asset-first conversational proof and runtime-record separation', () => {
    const arch = read('docs/architecture/controlled-conversational-system-execution.md');
    const adr = read('docs/adr/ADR-0023-controlled-conversational-system-execution.md');
    expect(arch).toContain('Layer A — Reusable conversational asset family');
    expect(arch).toContain('Layer B — Controlled runtime instances');
    expect(arch).toContain('`system.foundation` primitives → reusable conversational composite assets');
    expect(arch).toContain('Runtime records are operational records only and are never reusable asset substitutes.');
    expect(adr).toContain('Corrective decisions before Review A');
    expect(adr).toContain('must not duplicate foundation records into workspace authored storage merely through import/use');
  });
});
