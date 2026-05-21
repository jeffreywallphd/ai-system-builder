import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('execution preview wording',()=>{
 it('avoids run wording in plans tab',()=>{ const text=readFileSync('apps/desktop/src/renderer/features/asset-composition/components/AssetPlansTab.tsx','utf8'); expect(text).not.toContain('Run workflow'); expect(text).not.toContain('execute workflow'); expect(text).toContain('Plan preview');});
});
