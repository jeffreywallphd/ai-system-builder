import { useEffect, useMemo, useState } from "react";
import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";
import { RegistryService } from "../../services/RegistryService";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

function parseSystemComponents(content: string): ReadonlyArray<{
  readonly componentKind: "atomic" | "composite" | "system";
  readonly assetId: string;
  readonly versionId?: string;
  readonly alias?: string;
}> {
  if (!content.trim()) {
    return [];
  }
  const parsed = JSON.parse(content) as { readonly systemSpec?: { readonly components?: ReadonlyArray<{ readonly componentKind: "atomic" | "composite" | "system"; readonly assetId: string; readonly versionId?: string; readonly alias?: string }> } };
  return parsed.systemSpec?.components ?? [];
}

function kindFromAsset(asset: RegistryAsset): "atomic" | "composite" | "system" {
  return asset.taxonomy?.structuralKind === "composite"
    ? "composite"
    : asset.taxonomy?.structuralKind === "system"
      ? "system"
      : "atomic";
}

export function SystemCompositionEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const service = useMemo(() => new RegistryService(), []);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ReadonlyArray<RegistryAsset>>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState<string>();

  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const components = draft ? parseSystemComponents(draft.content) : [];

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setIsLoadingCandidates(true);
      const response = query.trim().length > 0
        ? await service.searchAssets({
          keyword: query.trim(),
          structuralKinds: ["atomic", "composite", "system"],
          limit: 50,
        })
        : await service.filterAssets({ structuralKinds: ["atomic", "composite", "system"], limit: 50 });

      if (!active) {
        return;
      }

      if (!response.ok || !response.data) {
        setCandidates([]);
        setCandidateError(response.error?.message ?? "Unable to load selectable assets.");
        setIsLoadingCandidates(false);
        return;
      }

      setCandidates(response.data.filter((asset) => asset.assetId !== draft?.assetId));
      setCandidateError(undefined);
      setIsLoadingCandidates(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [service, query, draft?.assetId]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-composition-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System composition structure editor</strong>
        <span className="ui-text-small ui-text-secondary">
          Manage bounded system child composition using atomic/composite/system asset references through backend-authoritative draft updates.
        </span>
      </div>

      <div className="ui-stack ui-stack--2xs">
        <strong>Selected components ({components.length})</strong>
        {components.length === 0 && (
          <span className="ui-text-small ui-text-secondary">No system components selected yet.</span>
        )}
        {components.map((component, index) => (
          <div key={`${component.assetId}:${component.versionId ?? ""}:${index}`} className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--2xs">
              <div><strong>{component.alias ?? `${component.componentKind}:${index + 1}`}</strong></div>
              <div className="ui-text-small">{component.componentKind} · {component.assetId} · {component.versionId ?? "unpinned"}</div>
              <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <button
                  className="ui-button"
                  disabled={!sessionId || !draft}
                  onClick={() => {
                    if (!sessionId || !draft) {
                      return;
                    }
                    void context.operations.reorderSystemChildComponent?.({
                      sessionId,
                      studioId: context.studioId,
                      draftId: draft.draftId,
                      componentAssetId: component.assetId,
                      componentVersionId: component.versionId,
                      toIndex: Math.max(0, index - 1),
                    });
                  }}
                >Move Up</button>
                <button
                  className="ui-button"
                  disabled={!sessionId || !draft}
                  onClick={() => {
                    if (!sessionId || !draft) {
                      return;
                    }
                    void context.operations.reorderSystemChildComponent?.({
                      sessionId,
                      studioId: context.studioId,
                      draftId: draft.draftId,
                      componentAssetId: component.assetId,
                      componentVersionId: component.versionId,
                      toIndex: Math.min(components.length - 1, index + 1),
                    });
                  }}
                >Move Down</button>
                <button
                  className="ui-button"
                  disabled={!sessionId || !draft}
                  onClick={() => {
                    if (!sessionId || !draft) {
                      return;
                    }
                    void context.operations.removeSystemChildComponent?.({
                      sessionId,
                      studioId: context.studioId,
                      draftId: draft.draftId,
                      componentAssetId: component.assetId,
                      componentVersionId: component.versionId,
                    });
                  }}
                >Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ui-stack ui-stack--2xs">
        <label className="ui-stack ui-stack--2xs">
          <span className="ui-text-small">Browse candidate assets</span>
          <input className="ui-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search registry assets" />
        </label>
        {isLoadingCandidates && <span className="ui-text-small ui-text-secondary">Loading candidates…</span>}
        {candidateError && <span className="ui-text-small" style={{ color: "var(--ui-color-danger-600, #b42318)" }}>{candidateError}</span>}
        <div className="ui-stack ui-stack--2xs">
          {candidates.slice(0, 12).map((asset) => (
            <div key={`${asset.assetId}:${asset.versionId}`} className="ui-row ui-row--wrap" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
              <span className="ui-text-small">{asset.name} · {asset.taxonomy?.structuralKind ?? "unknown"}/{asset.taxonomy?.semanticRole ?? "unknown"}</span>
              <button
                className="ui-button"
                disabled={!sessionId || !draft || !asset.versionId}
                onClick={() => {
                  if (!sessionId || !draft || !asset.versionId) {
                    return;
                  }
                  void context.operations.saveSystemChildComponent?.({
                    sessionId,
                    studioId: context.studioId,
                    draftId: draft.draftId,
                    component: {
                      componentKind: kindFromAsset(asset),
                      assetId: asset.assetId,
                      versionId: asset.versionId,
                      alias: `${kindFromAsset(asset)}-${asset.assetId.split(":").at(-1) ?? "component"}`,
                      taxonomy: asset.taxonomy,
                    },
                  });
                }}
              >Add</button>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-stack ui-stack--2xs">
        <strong>Nested system summary</strong>
        <ul className="ui-stack ui-stack--2xs">
          {components.filter((entry) => entry.componentKind === "system").map((entry, index) => (
            <li key={`${entry.assetId}:${entry.versionId ?? ""}:${index}`} className="ui-text-small">
              {entry.alias ?? `system-${index + 1}`} → {entry.assetId} ({entry.versionId ?? "unpinned"})
            </li>
          ))}
          {components.filter((entry) => entry.componentKind === "system").length === 0 && (
            <li className="ui-text-small ui-text-secondary">No nested systems selected.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
