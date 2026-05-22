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

  it('documents conversational-first runnable proof with non-executing phase 12 and explicit approval', () => {
    const arch = read('docs/architecture/controlled-conversational-system-execution.md');
    expect(arch).toContain('first runnable proof is now conversational');
    expect(arch).toContain('Phase 12 remains preview-only and non-executing');
    expect(arch).toContain('explicit approval');
    expect(arch).toContain('Conversation session');
    expect(arch).toContain('Execution run');
    expect(arch).toContain('Execution attempt');
    expect(arch).toContain('Execution event');
    expect(arch).toContain('Execution result');
    expect(arch).toContain('Prompt 1 is architecture/docs/context only');
    expect(arch).toContain('tools/retrieval/memory/multimodal');
    expect(arch).toContain('workflow/image/ComfyUI execution');
  });
});
