import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../security/secureFetch', () => ({ secureFetch: vi.fn() }));
vi.mock('../../../security/apiErrorEnvelope', () => ({ parseApiEnvelope: (v: unknown) => v }));
import { secureFetch } from '../../../security/secureFetch';
import { createThinClientEffectiveAssetProjectionsClient } from '../api/thinClientEffectiveAssetProjectionsClient';
describe('thin client effective asset projections client', () => {
  it('calls workspace-scoped list route', async () => {
    (secureFetch as any).mockResolvedValue({ json: async () => ({ ok: true, value: { summaries: [] } }) });
    await createThinClientEffectiveAssetProjectionsClient('/api').listProjections('workspace.1');
    expect((secureFetch as any).mock.calls[0][0]).toContain('/effective-asset-projections/workspaces/workspace.1/projections');
  });
});
