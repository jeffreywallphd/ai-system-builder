import { useEffect, useMemo, useState } from 'react';
import { createDesktopEffectiveAssetProjectionsClient } from '../api/desktopEffectiveAssetProjectionsClient';
const statusLabel = (s: string) => ({'ready':'Ready for planning','draft-only':'Draft preview','blocked':'Blocked','conflicted':'Needs attention','invalid':'Invalid','source-missing':'Missing source','unsupported':'Not supported','stale':'Refresh needed','disabled':'Disabled'}[s] ?? 'Needs attention');
export function EffectiveAssetProjectionsFeature({ workspaceId }: { workspaceId: string }) {
  const client = useMemo(() => createDesktopEffectiveAssetProjectionsClient(), []);
  const [items, setItems] = useState<any[]>([]); const [message, setMessage] = useState('Loading...');
  useEffect(() => { void client.listProjections(workspaceId).then((r:any)=>{ if(!r.ok){setMessage(r.error.message);return;} setItems(r.value.records ?? r.value.items ?? []); setMessage('');}); }, [client, workspaceId]);
  return <section><h2>Projection Readiness</h2>{message ? <p>{message}</p> : null}<p>Creating new projections from this page requires safe source selection and is not available yet.</p><ul>{items.map((item)=> <li key={item.projectionId}><strong>{item.projectedFields?.['display-name'] ?? item.source?.sourceLabel ?? 'Effective asset'}</strong> — {statusLabel(item.status)} {item.blockers?.length ? `(Blockers: ${item.blockers.length})`:''}</li>)}</ul></section>;
}
