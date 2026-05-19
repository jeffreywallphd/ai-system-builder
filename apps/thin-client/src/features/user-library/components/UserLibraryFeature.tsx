import { useEffect, useMemo, useState } from 'react';
import type { UserLibraryAssetRecord, UserLibraryEffectiveSourceKind, UserLibraryEffectiveSourceSummary, WorkspaceUserLibraryLinkRecord } from '../../../../../modules/contracts/user-library';
import { createThinClientUserLibraryClient } from '../api/thinClientUserLibraryClient';

const sourceLabel = (kind: UserLibraryEffectiveSourceKind) => kind === 'system-activated' ? 'Built-in system asset' : kind === 'workspace-local' ? 'Created in this workspace' : kind === 'user-library-linked' ? 'Linked from your reusable library' : kind === 'user-library-copied' ? 'Copied from your reusable library' : 'Imported from another workspace';

export function UserLibraryFeature({ workspaceId }: { workspaceId: string }) {
  const client = useMemo(() => createThinClientUserLibraryClient('/api'), []);
  const [assets, setAssets] = useState<readonly UserLibraryAssetRecord[]>([]);
  const [links, setLinks] = useState<readonly WorkspaceUserLibraryLinkRecord[]>([]);
  const [sources, setSources] = useState<readonly UserLibraryEffectiveSourceSummary[]>([]);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const a = await client.listAssets(); if (a.ok) setAssets(a.value.items);
    const l = await client.listLinks(workspaceId); if (l.ok) setLinks(l.value.items);
    const s = await client.listEffectiveSources(workspaceId); if (s.ok) setSources(s.value.items);
  };
  useEffect(() => { void refresh(); }, [workspaceId]);
  return <section><h2>Reusable Library</h2><p>Saved reusable assets</p><p><small>Promote/import flows are deferred in this minimal Phase 7 UI.</small></p>{message ? <p>{message}</p> : null}<ul>{assets.map((a) => <li key={a.userLibraryAssetId}><strong>{a.displayName}</strong> <button onClick={async ()=>{ const r=await client.link(workspaceId,{assetId:a.userLibraryAssetId,version:a.version}); setMessage(r.ok?'Linked to this workspace.':'Could not link this asset.'); await refresh();}}>Link to this workspace</button> <button onClick={async ()=>{ const r=await client.copy(workspaceId,{assetId:a.userLibraryAssetId,version:a.version}); setMessage(r.ok?'Copied into this workspace. Future library changes will not update this copy automatically.':'Could not copy this asset.'); await refresh();}}>Copy into this workspace</button></li>)}</ul><h3>Linked to this workspace</h3><ul>{links.map((l) => <li key={l.linkId}>{l.displayLabel ?? l.userLibraryAssetReference.assetId} — {l.propagationPolicy === 'explicit-update' ? 'Updates only when you choose to update' : 'Pinned version — no automatic updates'}</li>)}</ul><h3>What this workspace is using</h3><ul>{sources.map((s, i) => <li key={String(i)}>{sourceLabel(s.effectiveSourceKind)}</li>)}</ul></section>;
}
