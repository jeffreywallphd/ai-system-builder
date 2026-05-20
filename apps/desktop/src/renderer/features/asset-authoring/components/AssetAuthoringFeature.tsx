import { useEffect, useMemo, useState } from 'react';
import type {
  AssetAuthoringEffectiveSourceSummary,
  AssetOverrideRecord,
  AuthoredAssetDraftRecord,
  AuthoredAssetRecord,
} from '../../../../../../../modules/contracts/asset-authoring';
import { createDesktopAssetAuthoringClient } from '../api/desktopAssetAuthoringClient';

type RowVm = {
  id: string;
  label: string;
  statusLabel: string;
  description?: string;
  diagnosticLabel?: string;
  canPublish?: boolean;
  canUpdate?: boolean;
  canDisable?: boolean;
};

const safe = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const mapAuthored = (record: AuthoredAssetRecord): RowVm => ({
  id: record.authoredAssetId,
  label: safe(record.editableValues['display-name'], record.assetReference.label ?? 'Authored asset'),
  statusLabel: safe(record.status, 'Active'),
  description: safe(record.editableValues.summary, '') || undefined,
});

const mapDraft = (record: AuthoredAssetDraftRecord): RowVm => ({
  id: record.draftId,
  label: safe(record.draftEditableValues['display-name'], record.baseAssetReference?.label ?? 'Draft'),
  statusLabel: safe(record.status, 'Draft'),
  description: safe(record.draftEditableValues.summary, '') || undefined,
  canPublish: true,
  canUpdate: true,
});

const mapOverride = (record: AssetOverrideRecord): RowVm => ({
  id: record.overrideId,
  label: safe(record.overrideValues['display-name'], record.baseAssetReference.label ?? 'Customization'),
  statusLabel: safe(record.status, 'Active'),
  canDisable: record.status !== 'disabled',
});

const sourceLabel = (kind: unknown) =>
  kind === 'workspace-authored'
    ? 'Workspace authored'
    : kind === 'workspace-customized'
      ? 'Workspace customization'
      : kind === 'linked-with-workspace-override'
        ? 'Linked with workspace customization'
        : kind === 'system-derived-override'
          ? 'System-derived customization'
          : 'Workspace usage';

const mapSummary = (record: AssetAuthoringEffectiveSourceSummary, index: number): RowVm => ({
  id: `${record.effectiveAssetReference?.id ?? record.assetReference.id ?? 'summary'}-${index}`,
  label: sourceLabel(record.effectiveSourceKind),
  statusLabel:
    record.conflictStatus === 'open' ? 'Needs attention' : record.overrideStatus === 'disabled' ? 'Disabled' : 'Active',
});

export function AssetAuthoringFeature({ workspaceId, initialSection = "create" }: { workspaceId: string; initialSection?: "create" | "drafts" | "customizations" }) {
  const client = useMemo(() => createDesktopAssetAuthoringClient(), []);
  const [authored, setAuthored] = useState<RowVm[]>([]);
  const [drafts, setDrafts] = useState<RowVm[]>([]);
  const [overrides, setOverrides] = useState<RowVm[]>([]);
  const [summaries, setSummaries] = useState<RowVm[]>([]);
  const [summariesUnavailable, setSummariesUnavailable] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const sectionMatches = {
    create: initialSection === "create",
    drafts: initialSection === "drafts",
    customizations: initialSection === "customizations",
  };

  const refresh = async () => {
    const [authoredResult, draftsResult, overridesResult, summariesResult] = await Promise.all([
      client.listAuthoredAssets(workspaceId),
      client.listDrafts(workspaceId),
      client.listOverrides(workspaceId),
      client.listEffectiveSummaries(workspaceId),
    ]);

    if (authoredResult.ok === true) setAuthored(authoredResult.value.items.map(mapAuthored));
    if (draftsResult.ok === true) setDrafts(draftsResult.value.items.map(mapDraft));
    if (overridesResult.ok === true) setOverrides(overridesResult.value.items.map(mapOverride));
    if (summariesResult.ok === true) {
      setSummaries(summariesResult.value.items.map(mapSummary));
      setSummariesUnavailable(false);
    } else if (summariesResult.error.code === 'unavailable') {
      setSummaries([]);
      setSummariesUnavailable(true);
    }
    if (authoredResult.ok === false || draftsResult.ok === false || overridesResult.ok === false) {
      setMessage('Some data is not available yet.');
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  return (
    <section>
      <h2>Create and manage workspace assets</h2>
      {sectionMatches.create ? <h3>Created assets</h3> : null}
      <ul>
        {authored.length ? (
          authored.map((asset) => (
            <li key={asset.id}>
              <strong>{asset.label}</strong> - {asset.statusLabel}
            </li>
          ))
        ) : (
          <li>No custom assets yet.</li>
        )}
      </ul>
      {sectionMatches.drafts ? <h3>Drafts</h3> : null}
      <ul>
        {drafts.length ? (
          drafts.map((draft) => (
            <li key={draft.id}>
              <strong>{draft.label}</strong> - {draft.statusLabel}{' '}
              <button
                onClick={async () => {
                  const result = await client.publishDraft(workspaceId, draft.id);
                  setMessage(result.ok === true ? 'Draft published.' : result.error.message);
                  if (result.ok === true) await refresh();
                }}
              >
                Publish
              </button>{' '}
              <button
                onClick={async () => {
                  const result = await client.updateDraft({
                    workspaceId,
                    draftId: draft.id,
                    summary: 'Updated in workspace',
                  });
                  setMessage(result.ok === true ? 'Draft changes saved.' : result.error.message);
                  if (result.ok === true) await refresh();
                }}
              >
                Save changes
              </button>
            </li>
          ))
        ) : (
          <li>No drafts yet.</li>
        )}
      </ul>
      <h3>Create asset draft</h3>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) {
            setMessage('Name is required.');
            return;
          }
          const result = await client.createDraft({ workspaceId, displayName: name, summary });
          if (result.ok === true) {
            setName('');
            setSummary('');
            setMessage('Saved as draft.');
            await refresh();
          } else {
            setMessage(result.error.message);
          }
        }}
      >
        <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="Short summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
        <button type="submit">Create asset draft</button>
      </form>
      {sectionMatches.customizations ? <h3>Customizations</h3> : null}
      <p>
        <small>Creating new customizations is not available yet.</small>
      </p>
      <ul>
        {overrides.length ? (
          overrides.map((override) => (
            <li key={override.id}>
              {override.label} - {override.statusLabel}{' '}
              {override.canDisable ? (
                <button
                  onClick={async () => {
                    const result = await client.disableOverride(workspaceId, override.id);
                    setMessage(result.ok === true ? 'Customization turned off.' : result.error.message);
                    if (result.ok === true) await refresh();
                  }}
                >
                  Disable customization
                </button>
              ) : null}
            </li>
          ))
        ) : (
          <li>No customizations yet.</li>
        )}
      </ul>
      <h3>What this workspace is using</h3>
      {summariesUnavailable ? (
        <p>Workspace usage summaries are not available yet.</p>
      ) : (
        <ul>
          {summaries.length ? (
            summaries.map((summaryItem) => (
              <li key={summaryItem.id}>
                {summaryItem.label} - {summaryItem.statusLabel}
              </li>
            ))
          ) : (
            <li>No workspace usage summaries yet.</li>
          )}
        </ul>
      )}
      {message ? <p>{message}</p> : null}
    </section>
  );
}
