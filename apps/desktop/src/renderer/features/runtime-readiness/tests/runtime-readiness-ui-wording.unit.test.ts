import { readFileSync } from 'node:fs';
import { describe, expect, it } from '../../../../../../../modules/testing/node-test';

describe('runtime-readiness UI wording guardrails', () => {
  it('keeps setup wording and avoids execution wording in Asset Plans setup UI', () => {
    const desktop = readFileSync('apps/desktop/src/renderer/features/asset-composition/components/AssetPlansTab.tsx', 'utf8');
    const thin = readFileSync('apps/thin-client/src/features/asset-composition/components/AssetPlansTab.tsx', 'utf8');
    for (const source of [desktop, thin]) {
      expect(source).toContain('Nothing runs from this screen.');
      expect(source).toContain('Check setup');
      expect(source).not.toContain('ready-to-run');
      expect(source).not.toContain('execution-ready');
      expect(source).not.toContain('start workflow');
      expect(source).not.toContain('invoke provider');
    }
  });
});
