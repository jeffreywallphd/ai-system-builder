import { useEffect, useMemo, useState } from 'react';
import type { AssetAuthoringEffectiveSourceSummary, AssetOverrideRecord, AuthoredAssetDraftRecord, AuthoredAssetRecord } from '../../../../../../../modules/contracts/asset-authoring';
import { createDesktopAssetAuthoringClient } from '../api/desktopAssetAuthoringClient';

type RowVm = { id: string; label: string; statusLabel: string; description?: string; diagnosticLabel?: string; canPublish?: boolean; canUpdate?: boolean; canDisable?: boolean };
const safe = (value: unknown, fallback: string) => typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
const mapAuthored = (r: AuthoredAssetRecord): RowVm => ({ id: r.authoredAssetId, label: safe(r.editableFields?.displayName, 'Authored asset'), statusLabel: safe(r.status, 'Active'), description: safe(r.editableFields?.summary, '') || undefined });
const mapDraft = (r: AuthoredAssetDraftRecord): RowVm => ({ id: r.draftId, label: safe(r.editableFields?.displayName, 'Draft'), statusLabel: safe(r.status, 'Draft'), description: safe(r.editableFields?.summary, '') || undefined, canPublish: true, canUpdate: true });
const mapOverride = (r: AssetOverrideRecord): RowVm => ({ id: r.overrideId, label: safe(r.displayLabel, 'Customization'), statusLabel: safe(r.status, 'Active'), canDisable: r.status !== 'disabled' });
const sourceLabel = (k: unknown) => k === 'workspace-authored' ? 'Workspace authored' : k === 'workspace-customized' ? 'Workspace customization' : k === 'linked-with-workspace-override' ? 'Linked with workspace customization' : k === 'system-derived-override' ? 'System-derived customization' : 'Workspace usage';
const mapSummary = (r: AssetAuthoringEffectiveSourceSummary, index: number): RowVm => ({ id: `${r.assetId ?? 'summary'}-${index}`, label: sourceLabel(r.effectiveSourceKind), statusLabel: r.hasConflict ? 'Conflict' : r.disabled ? 'Disabled' : 'Active' });

export function AssetAuthoringFeature({ workspaceId }: { workspaceId: string }) {
  const client = useMemo(() => createDesktopAssetAuthoringClient(), []);
  const [authored, setAuthored] = useState<RowVm[]>([]);
  const [drafts, setDrafts] = useState<RowVm[]>([]);
  const [overrides, setOverrides] = useState<RowVm[]>([]);
  const [summaries, setSummaries] = useState<RowVm[]>([]);
  const [summariesUnavailable, setSummariesUnavailable] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState(''); const [summary, setSummary] = useState('');
  const refresh = async () => {
    const [a, d, o, s] = await Promise.all([client.listAuthoredAssets(workspaceId), client.listDrafts(workspaceId), client.listOverrides(workspaceId), client.listEffectiveSummaries(workspaceId)]);
    if (a.ok) setAuthored(a.value.items.map(mapAuthored));
    if (d.ok) setDrafts(d.value.items.map(mapDraft));
    if (o.ok) setOverrides(o.value.items.map(mapOverride));
    if (s.ok) { setSummaries(s.value.items.map(mapSummary)); setSummariesUnavailable(false); }
    else if (s.error.code === 'unavailable') { setSummaries([]); setSummariesUnavailable(true); }
    if (!a.ok || !d.ok || !o.ok) setMessage('Some data is not available yet.');
  };
  useEffect(() => { void refresh(); }, [workspaceId]);
  return <section><h2>Asset Authoring</h2><h3>Custom Assets</h3><ul>{authored.length ? authored.map((a) => <li key={a.id}><strong>{a.label}</strong> — {a.statusLabel}</li>) : <li>No custom assets yet.</li>}</ul><h3>Drafts</h3><ul>{drafts.length ? drafts.map((d) => <li key={d.id}><strong>{d.label}</strong> — {d.statusLabel} <button onClick={async () => { const r=await client.publishDraft(workspaceId, d.id); setMessage(r.ok?'Publish requested.':r.error.message); if (r.ok) await refresh(); }}>Publish draft</button> <button onClick={async () => { const r=await client.updateDraft({ workspaceId, draftId: d.id, summary: 'Updated in workspace' }); setMessage(r.ok?'Draft updated.':r.error.message); if (r.ok) await refresh(); }}>Save safe edit</button></li>) : <li>No drafts yet.</li>}</ul><h3>Create draft</h3><form onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) { setMessage('Display name is required.'); return; } const r=await client.createDraft({ workspaceId, displayName: name, summary }); if (r.ok) { setName(''); setSummary(''); setMessage('Draft created.'); await refresh(); } else setMessage(r.error.message); }}><input aria-label='Display name' value={name} onChange={(e) => setName(e.target.value)} /><input aria-label='Summary' value={summary} onChange={(e) => setSummary(e.target.value)} /><button type='submit'>Create draft</button></form><h3>Workspace customizations</h3><p><small>Creating new customizations is not available yet.</small></p><ul>{overrides.length ? overrides.map((o) => <li key={o.id}>{o.label} — {o.statusLabel} {o.canDisable ? <button onClick={async () => { const r=await client.disableOverride(workspaceId, o.id); setMessage(r.ok?'Customization disabled.':r.error.message); if (r.ok) await refresh(); }}>Disable customization</button> : null}</li>) : <li>No workspace customizations yet.</li>}</ul><h3>What this workspace is using</h3>{summariesUnavailable ? <p>Workspace usage summaries are not available yet.</p> : <ul>{summaries.length ? summaries.map((s) => <li key={s.id}>{s.label} — {s.statusLabel}</li>) : <li>No workspace usage summaries yet.</li>}</ul>}{message ? <p>{message}</p> : null}</section>;
}
