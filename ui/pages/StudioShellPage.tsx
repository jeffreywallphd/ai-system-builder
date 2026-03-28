import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AssetDraftLifecycleStatuses, type AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import type { StudioShellSnapshotReadModel, StudioShellValidationIssue } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { StudioShellService } from "../services/StudioShellService";
import { StudioShellPanel } from "../components/studio-shell/StudioShellPanel";
import { StudioShellValidationIssuesPanel } from "../components/studio-shell/StudioShellValidationIssuesPanel";
import {
  type StudioRegistration,
  StudioShellExtensionRegistry,
  StudioShellExtensionSlots,
  type StudioShellExtensionContext,
  type StudioShellExtensionContribution,
  type StudioShellExtensionSlot,
} from "../studio-shell/StudioShellExtensions";

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


function buildCreateMetadata(
  defaultDraftTitle: string,
  defaultDraftTags: ReadonlyArray<string>,
  metadataPatchJson: string,
): {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly taxonomy?: AssetMetadataPatch["taxonomy"];
  readonly contract?: AssetMetadataPatch["contract"];
  readonly provenance?: AssetMetadataPatch["provenance"];
} {
  const metadataPatch = safeParseJson<AssetMetadataPatch>(metadataPatchJson, {});
  return {
    title: metadataPatch.title ?? defaultDraftTitle,
    summary: metadataPatch.summary,
    tags: metadataPatch.tags ?? defaultDraftTags,
    taxonomy: metadataPatch.taxonomy,
    contract: metadataPatch.contract,
    provenance: metadataPatch.provenance,
  };
}

interface StudioShellPageProps {
  readonly studioRegistration?: StudioRegistration;
  readonly extensions?: ReadonlyArray<StudioShellExtensionContribution>;
}

function renderExtensions(
  registry: StudioShellExtensionRegistry,
  slot: StudioShellExtensionSlot,
  context: StudioShellExtensionContext,
): JSX.Element | null {
  const extensions = registry.listBySlot(slot);
  if (extensions.length === 0) {
    return null;
  }

  return (
    <>
      {extensions.map((extension) => (
        <StudioShellPanel key={extension.id} title={extension.title} subtitle={extension.subtitle}>
          {extension.render(context)}
        </StudioShellPanel>
      ))}
    </>
  );
}

export default function StudioShellPage({ studioRegistration, extensions = [] }: StudioShellPageProps): JSX.Element {
  const studioId = studioRegistration?.studioId ?? "studio-shell-main";
  const defaultDraftTitle = studioRegistration?.defaults.title ?? "Studio Shell Draft";
  const defaultDraftTags = studioRegistration?.defaults.tags ?? ["studio-shell"];
  const defaultContent = studioRegistration?.defaults.contentTemplate ?? "{}";
  const shellTitle = studioRegistration?.shell?.title ?? studioRegistration?.displayName ?? "Studio Shell";
  const shellSubtitle = studioRegistration?.shell?.subtitle
    ?? (studioRegistration
      ? `Shared ${studioRegistration.kind}-studio shell for ${studioRegistration.role} assets: session/draft context, metadata/dependencies, lifecycle/version, and validation.`
      : "Reusable bounded shell for studio/session context, authoring, taxonomy/contract/provenance/dependencies, lifecycle/version state, and validation.");
  const service = useMemo(() => new StudioShellService(), []);
  const location = useLocation();
  const extensionRegistry = useMemo(() => {
    const registry = new StudioShellExtensionRegistry();
    registry.registerMany([...(studioRegistration?.extensions ?? []), ...extensions]);
    return registry;
  }, [studioRegistration, extensions]);
  const [snapshot, setSnapshot] = useState<StudioShellSnapshotReadModel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [validationIssues, setValidationIssues] = useState<ReadonlyArray<StudioShellValidationIssue>>([]);
  const [systemCompatibility, setSystemCompatibility] = useState<StudioShellExtensionContext["systemCompatibility"]>();
  const [isBusy, setIsBusy] = useState(false);
  const [content, setContent] = useState(defaultContent);
  const [metadataPatchJson, setMetadataPatchJson] = useState(
    JSON.stringify(studioRegistration?.defaults.metadataPatch ?? { title: defaultDraftTitle, tags: defaultDraftTags }),
  );
  const [dependenciesJson, setDependenciesJson] = useState(
    JSON.stringify(studioRegistration?.defaults.dependencies ?? []),
  );

  const refreshSnapshot = async () => {
    setIsBusy(true);
    try {
      const response = await service.loadSnapshot(studioId);
      if (!response.ok) {
        setError(response.error?.message ?? "Failed to load Studio Shell snapshot.");
        return;
      }
      if (!response.data) {
        const initialized = await service.initializeStudio(studioId, studioRegistration?.displayName ?? "Studio Shell");
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
      if (studioRegistration?.kind === "system" && response.data.draft?.draftId) {
        const compatibilityResponse = await service.getSystemCompatibilityInsights({
          studioId,
          draftId: response.data.draft.draftId,
        });
        setSystemCompatibility(compatibilityResponse.ok ? compatibilityResponse.data : undefined);
      } else {
        setSystemCompatibility(undefined);
      }
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
  }, [studioId]);

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

  const extensionContext: StudioShellExtensionContext = {
    studioId,
    snapshot,
    validationIssues,
    systemCompatibility,
    handoffContext: {
      assetId: new URLSearchParams(location.search).get("assetId")?.trim() || undefined,
      versionId: new URLSearchParams(location.search).get("versionId")?.trim() || undefined,
      handoff: new URLSearchParams(location.search).get("handoff")?.trim() || undefined,
      registryContext: new URLSearchParams(location.search).get("registryContext")?.trim() || undefined,
      selectedComponent: new URLSearchParams(location.search).get("selectedComponent")?.trim() || undefined,
    },
    operationError: error,
    isBusy,
    operations: {
      refresh: refreshSnapshot,
      startSystemExecution: async (request) => service.startSystemExecution(request),
      getSystemExecutionStatus: async (executionId) => service.getSystemExecutionStatus(executionId),
      saveSystemChildComponent: async (request) => {
        const response = await service.addSystemChildComponent(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to add system child component.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      removeSystemChildComponent: async (request) => {
        const response = await service.removeSystemChildComponent(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to remove system child component.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      reorderSystemChildComponent: async (request) => {
        const response = await service.reorderSystemChildComponent(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to reorder system child component.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      updateSystemInterfaces: async (request) => {
        const response = await service.updateSystemInterfaces(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to update system interfaces.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      updateSystemParameters: async (request) => {
        const response = await service.updateSystemParameters(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to update system parameters.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
      updateSystemExecutionMetadata: async (request) => {
        const response = await service.updateSystemExecutionMetadata(request);
        if (!response.ok) {
          setError(response.error?.message ?? "Failed to update system execution metadata.");
          return false;
        }
        await refreshSnapshot();
        setError(undefined);
        return true;
      },
    },
  };

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="studio-shell-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{shellTitle}</h1>
          <p className="ui-page__subtitle">{shellSubtitle}</p>
        </div>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <StudioShellPanel title="Studio/session context" subtitle="Current studio, active session, and draft context.">
          <div className="ui-stack ui-stack--2xs">
            <div><strong>Studio:</strong> {snapshot?.studioName ?? "-"} ({snapshot?.studioId ?? studioId})</div>
            <div><strong>Session:</strong> {snapshot?.activeSessionId ?? "-"} ({snapshot?.sessionStatus ?? "n/a"})</div>
            <div><strong>Draft:</strong> {snapshot?.draft?.draftId ?? "-"}</div>
            <div><strong>Revision:</strong> {snapshot?.draft?.revision ?? 0}</div>
          </div>
          <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
            <button className="ui-button" disabled={isBusy} onClick={() => { void refreshSnapshot(); }}>Refresh</button>
            <button className="ui-button" disabled={isBusy} onClick={() => { void runAndRefresh(() => service.startSession(studioId)); }}>Start Session</button>
          </div>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.sessionContext, extensionContext)}

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
                  const metadata = buildCreateMetadata(defaultDraftTitle, defaultDraftTags, metadataPatchJson);
                  void runAndRefresh(() => service.createDraft({
                    studioId,
                    sessionId,
                    content,
                    metadata,
                  }));
                  return;
                }
                const metadataPatch = safeParseJson<AssetMetadataPatch>(metadataPatchJson, {});
                void runAndRefresh(() => service.updateDraft({
                  studioId,
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
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.draftAuthoring, extensionContext)}

        <StudioShellPanel title="Taxonomy / contract / provenance" subtitle="JSON metadata patch surface (backend/application remains authoritative).">
          <textarea className="ui-textarea" rows={8} value={metadataPatchJson} onChange={(event) => setMetadataPatchJson(event.target.value)} />
          <p className="ui-text-muted">Use keys like taxonomy, contract, provenance, title, summary, and tags in metadataPatch JSON.</p>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.metadata, extensionContext)}

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
                studioId,
                sessionId,
                draftId,
                dependencies,
              }));
            }}
          >
            Save Dependencies
          </button>
        </StudioShellPanel>
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.dependencies, extensionContext)}

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
                  studioId,
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
                  studioId,
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
                  studioId,
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
                  const response = await service.validateDraft(studioId, draftId);
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
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.lifecycle, extensionContext)}

        <StudioShellValidationIssuesPanel operationError={error} validationIssues={validationIssues} />
        {renderExtensions(extensionRegistry, StudioShellExtensionSlots.validation, extensionContext)}
      </div>
    </section>
  );
}
