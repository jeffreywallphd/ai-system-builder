import { useEffect, useMemo, useState } from "react";
import { AssetDraftLifecycleStatuses, type AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import type { StudioShellSnapshotReadModel, StudioShellValidationIssue } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { StudioShellService } from "../services/StudioShellService";
import { StudioShellPanel } from "../components/studio-shell/StudioShellPanel";
import { StudioShellValidationIssuesPanel } from "../components/studio-shell/StudioShellValidationIssuesPanel";

const DEFAULT_STUDIO_ID = "studio-shell-main";

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    if (!value.trim()) {
      return fallback;
    }
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function StudioShellPage(): JSX.Element {
  const service = useMemo(() => new StudioShellService(), []);
  const [snapshot, setSnapshot] = useState<StudioShellSnapshotReadModel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [validationIssues, setValidationIssues] = useState<ReadonlyArray<StudioShellValidationIssue>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [content, setContent] = useState("{}");
  const [metadataPatchJson, setMetadataPatchJson] = useState('{"title":"Studio Shell Draft","tags":["studio-shell"]}');
  const [dependenciesJson, setDependenciesJson] = useState('[{"assetId":"asset:seed"}]');

  const refreshSnapshot = async () => {
    setIsBusy(true);
    try {
      const response = await service.loadSnapshot(DEFAULT_STUDIO_ID);
      if (!response.ok) {
        setError(response.error?.message ?? "Failed to load Studio Shell snapshot.");
        return;
      }
      if (!response.data) {
        const initialized = await service.initializeStudio(DEFAULT_STUDIO_ID, "Studio Shell");
        if (!initialized.ok || !initialized.data) {
          setError(initialized.error?.message ?? "Failed to initialize Studio Shell.");
          return;
        }
        setSnapshot(initialized.data);
        setValidationIssues(initialized.data.validationIssues);
        return;
      }
      setSnapshot(response.data);
      setValidationIssues(response.data.validationIssues);
      setError(undefined);
      if (response.data.draft) {
        setContent(response.data.draft.content);
      }
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void refreshSnapshot();
  }, []);

  const runAndRefresh = async (action: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setIsBusy(true);
    try {
      const response = await action();
      if (!response.ok) {
        setError(response.error?.message ?? "Studio shell operation failed.");
        return;
      }
      await refreshSnapshot();
      setError(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const sessionId = snapshot?.activeSessionId;
  const draftId = snapshot?.draft?.draftId;

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="studio-shell-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Studio Shell</h1>
          <p className="ui-page__subtitle">Reusable bounded shell for studio/session context, authoring, taxonomy/contract/provenance/dependencies, lifecycle/version state, and validation.</p>
        </div>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <StudioShellPanel title="Studio/session context" subtitle="Current studio, active session, and draft context.">
          <div className="ui-stack ui-stack--2xs">
            <div><strong>Studio:</strong> {snapshot?.studioName ?? "-"} ({snapshot?.studioId ?? DEFAULT_STUDIO_ID})</div>
            <div><strong>Session:</strong> {snapshot?.activeSessionId ?? "-"} ({snapshot?.sessionStatus ?? "n/a"})</div>
            <div><strong>Draft:</strong> {snapshot?.draft?.draftId ?? "-"}</div>
            <div><strong>Revision:</strong> {snapshot?.draft?.revision ?? 0}</div>
          </div>
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
            <button className="ui-button" disabled={isBusy} onClick={() => { void refreshSnapshot(); }}>Refresh</button>
            <button className="ui-button" disabled={isBusy} onClick={() => { void runAndRefresh(() => service.startSession(DEFAULT_STUDIO_ID)); }}>Start Session</button>
          </div>
        </StudioShellPanel>

        <StudioShellPanel title="Asset draft authoring" subtitle="Thin authoring surface over studio-shell draft contracts.">
          <textarea className="ui-textarea" rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
            <button
              className="ui-button ui-button--primary"
              disabled={isBusy || !sessionId}
              onClick={() => {
                if (!sessionId) {
                  return;
                }
                if (!draftId) {
                  void runAndRefresh(() => service.createDraft({
                    studioId: DEFAULT_STUDIO_ID,
                    sessionId,
                    content,
                    metadata: { title: "Studio Shell Draft", tags: ["studio-shell"] },
                  }));
                  return;
                }
                const metadataPatch = safeParseJson<AssetMetadataPatch>(metadataPatchJson, {});
                void runAndRefresh(() => service.updateDraft({
                  studioId: DEFAULT_STUDIO_ID,
                  sessionId,
                  draftId,
                  content,
                  metadataPatch,
                }));
              }}
            >
              {draftId ? "Save Draft" : "Create Draft"}
            </button>
          </div>
        </StudioShellPanel>

        <StudioShellPanel title="Taxonomy / contract / provenance" subtitle="JSON metadata patch surface (backend/application remains authoritative).">
          <textarea className="ui-textarea" rows={8} value={metadataPatchJson} onChange={(event) => setMetadataPatchJson(event.target.value)} />
          <p className="ui-text-muted">Use keys like taxonomy, contract, provenance, title, summary, and tags in metadataPatch JSON.</p>
        </StudioShellPanel>

        <StudioShellPanel title="Dependencies" subtitle="Draft dependency references and version pinning.">
          <textarea className="ui-textarea" rows={8} value={dependenciesJson} onChange={(event) => setDependenciesJson(event.target.value)} />
          <button
            className="ui-button"
            disabled={isBusy || !sessionId || !draftId}
            onClick={() => {
              if (!sessionId || !draftId) {
                return;
              }
              const dependencies = safeParseJson<Array<{ assetId: string; versionId?: string }>>(dependenciesJson, []);
              void runAndRefresh(() => service.updateDependencies({
                studioId: DEFAULT_STUDIO_ID,
                sessionId,
                draftId,
                dependencies,
              }));
            }}
          >
            Save Dependencies
          </button>
        </StudioShellPanel>

        <StudioShellPanel title="Lifecycle / publish / version status" subtitle="Explicit draft lifecycle transitions and publish/version operations.">
          <div className="ui-stack ui-stack--2xs">
            <div><strong>Lifecycle:</strong> {snapshot?.draft?.lifecycleStatus ?? "n/a"}</div>
            <div><strong>Published versions:</strong> {snapshot?.versions.length ?? 0}</div>
            <div><strong>Last published:</strong> {snapshot?.draft?.lastPublishedVersionId ?? "-"}</div>
          </div>
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <button
              className="ui-button"
              disabled={isBusy || !sessionId || !draftId}
              onClick={() => {
                if (!sessionId || !draftId) {
                  return;
                }
                void runAndRefresh(() => service.transitionLifecycle({
                  studioId: DEFAULT_STUDIO_ID,
                  sessionId,
                  draftId,
                  targetStatus: AssetDraftLifecycleStatuses.validated,
                }));
              }}
            >Mark Validated</button>
            <button
              className="ui-button"
              disabled={isBusy || !sessionId || !draftId}
              onClick={() => {
                if (!sessionId || !draftId) {
                  return;
                }
                void runAndRefresh(() => service.transitionLifecycle({
                  studioId: DEFAULT_STUDIO_ID,
                  sessionId,
                  draftId,
                  targetStatus: AssetDraftLifecycleStatuses.draft,
                }));
              }}
            >Back to Draft</button>
            <button
              className="ui-button ui-button--primary"
              disabled={isBusy || !sessionId || !draftId}
              onClick={() => {
                if (!sessionId || !draftId) {
                  return;
                }
                void runAndRefresh(() => service.publishVersion({
                  studioId: DEFAULT_STUDIO_ID,
                  sessionId,
                  draftId,
                }));
              }}
            >Publish Version</button>
            <button
              className="ui-button"
              disabled={isBusy || !draftId}
              onClick={() => {
                if (!draftId) {
                  return;
                }
                void runAndRefresh(async () => {
                  const response = await service.validateDraft(DEFAULT_STUDIO_ID, draftId);
                  if (response.ok && response.data) {
                    setValidationIssues(response.data);
                  }
                  return response;
                });
              }}
            >Run Validation</button>
          </div>
          <ul className="ui-stack ui-stack--2xs">
            {(snapshot?.versions ?? []).map((version) => (
              <li key={version.versionId}>{version.versionLabel ?? version.versionId} · {version.createdAt}</li>
            ))}
          </ul>
        </StudioShellPanel>

        <StudioShellValidationIssuesPanel operationError={error} validationIssues={validationIssues} />
      </div>
    </section>
  );
}
