import { useEffect, useMemo, useState } from 'react';
import { createThinClientUserLibraryClient } from '../api/thinClientUserLibraryClient';

export function UserLibraryFeature({ workspaceId }: { workspaceId: string }) {
  const client = useMemo(() => createThinClientUserLibraryClient('/api'), []);
  const [assets, setAssets] = useState<any[]>([]); const [links, setLinks] = useState<any[]>([]); const [sources, setSources] = useState<any[]>([]); const [message, setMessage] = useState('');
  const refresh = async () => { const a = await client.listAssets(); if (a.ok) setAssets(a.value.items ?? []); const l = await client.listLinks(workspaceId); if (l.ok) setLinks(l.value.items ?? []); const s = await client.listEffectiveSources(workspaceId); if (s.ok) setSources(s.value.items ?? []); };
  useEffect(() => { void refresh(); }, [workspaceId]);
  return <section><h2>Reusable Library</h2><p>Saved reusable assets</p>{message ? <p>{message}</p> : null}<ul>{assets.map((a) => <li key={a.assetId ?? a.id}><strong>{a.displayName ?? a.assetId}</strong> <button onClick={async ()=>{ const r=await client.link(workspaceId,{assetId:a.assetId,version:a.version}); setMessage(r.ok?'Linked to this workspace.':'Could not link this asset.'); await refresh();}}>Link to this workspace</button> <button onClick={async ()=>{ const r=await client.copy(workspaceId,{assetId:a.assetId,version:a.version}); setMessage(r.ok?'Copied into this workspace. Future library changes will not update this copy automatically.':'Could not copy this asset.'); await refresh();}}>Copy into this workspace</button></li>)}</ul><h3>Linked to this workspace</h3><ul>{links.map((l) => <li key={l.linkId ?? l.id}>{l.linkLabel ?? l.userLibraryAssetReference?.assetId}</li>)}</ul><h3>What this workspace is using</h3><ul>{sources.map((s, i) => <li key={String(i)}>{s.sourceKind ?? 'unknown'}</li>)}</ul></section>;
}
