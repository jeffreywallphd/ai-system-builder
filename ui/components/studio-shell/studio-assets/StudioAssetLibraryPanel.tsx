import { useMemo, useState } from "react";
import StudioAssetInspectorPanel from "./StudioAssetInspectorPanel";
import StudioAssetPreviewCard from "./StudioAssetPreviewCard";
import type { StudioAssetCompositionNode } from "../../../studio-shell/studio-assets/StudioAssetComposition";
import type { StudioAssetRegistrationCategory, StudioAssetRegistry } from "../../../studio-shell/studio-assets/StudioAssetRegistry";
import { listStudioAssetLibrarySections, type StudioAssetLibraryEntry } from "../../../studio-shell/studio-assets/StudioAssetLibrary";
import type { StudioAssetSelectionState } from "../../../studio-shell/studio-assets/StudioAssetSelection";
import { bindStudioAssetSelection } from "../../../studio-shell/studio-assets/StudioAssetSelection";
import { createStudioAssetPreviewModel } from "../../../studio-shell/studio-assets/StudioAssetPreview";

export interface StudioAssetLibraryPanelProps {
  readonly registry: StudioAssetRegistry;
  readonly title?: string;
  readonly description?: string;
  readonly categoryFilter?: ReadonlyArray<StudioAssetRegistrationCategory>;
  readonly onInsertAsset?: (entry: StudioAssetLibraryEntry) => void;
  readonly selectedAssetNode?: StudioAssetCompositionNode;
  readonly compositionRoot?: StudioAssetCompositionNode;
  readonly selection?: StudioAssetSelectionState;
  readonly onChangeSelectedAssetConfig?: (nextConfig: Readonly<Record<string, unknown>>) => void;
  readonly onChangeSelection?: (nextSelection: StudioAssetSelectionState) => void;
}

const defaultCategories = Object.freeze([
  "atomic-ui",
  "composed-ui",
  "system-page",
] satisfies ReadonlyArray<StudioAssetRegistrationCategory>);

function formatIcon(iconToken: string | undefined): string {
  if (!iconToken) {
    return "◻";
  }
  if (iconToken.includes("workflow")) {
    return "🧭";
  }
  if (iconToken.includes("system")) {
    return "🧩";
  }
  if (iconToken.includes("dataset")) {
    return "🗂";
  }
  return "◻";
}

export default function StudioAssetLibraryPanel({
  registry,
  title = "Asset Library",
  description = "Browse reusable interface assets and insert them where they fit.",
  categoryFilter = defaultCategories,
  onInsertAsset,
  selectedAssetNode,
  compositionRoot,
  selection,
  onChangeSelectedAssetConfig,
  onChangeSelection,
}: StudioAssetLibraryPanelProps): JSX.Element {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => listStudioAssetLibrarySections({
    registry,
    query: {
      searchText: query,
      categories: categoryFilter,
    },
  }), [registry, query, categoryFilter]);

  const boundSelection = useMemo(
    () => bindStudioAssetSelection({ root: compositionRoot, selection }),
    [compositionRoot, selection],
  );
  const activeNode = boundSelection.selectedNode ?? selectedAssetNode;

  return (
    <section className="ui-stack ui-stack--sm" data-testid="studio-asset-library-panel">
      <div className="ui-stack ui-stack--2xs">
        <strong>{title}</strong>
        <p className="ui-text-small ui-text-secondary">{description}</p>
      </div>

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Search assets</span>
        <input
          className="ui-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, description, or tags"
        />
      </label>

      {sections.length === 0 ? (
        <p className="ui-text-small ui-text-secondary">No assets matched this search.</p>
      ) : (
        <div className="ui-stack ui-stack--xs">
          {sections.map((section) => (
            <div key={section.id} className="ui-card ui-card--padded ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap">
                <strong>{section.title}</strong>
                <span className="ui-text-small ui-text-secondary">{section.entries.length}</span>
              </div>

              <ul className="ui-stack ui-stack--2xs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {section.entries.map((entry) => {
                  const registration = registry.getById(entry.id);
                  const preview = registration ? createStudioAssetPreviewModel({ registration }) : undefined;
                  return (
                    <li key={entry.id} className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                      <div className="ui-stack ui-stack--3xs" style={{ minWidth: "12rem", maxWidth: "26rem" }}>
                        <div>
                          <span aria-hidden="true">{formatIcon(entry.iconToken)} </span>
                          <strong>{entry.title}</strong>
                        </div>
                        {entry.description ? (
                          <span className="ui-text-small ui-text-secondary">{entry.description}</span>
                        ) : null}
                        <span className="ui-text-small ui-text-secondary">
                          {entry.group} · {entry.contractCategory}
                        </span>
                        {preview ? <StudioAssetPreviewCard preview={preview} compact /> : null}
                      </div>
                      {onInsertAsset ? (
                        <button
                          type="button"
                          className="ui-button ui-button--sm ui-button--ghost"
                          onClick={() => onInsertAsset(entry)}
                        >
                          Insert
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <StudioAssetInspectorPanel
        registry={registry}
        selectedAssetNode={activeNode}
        compositionRoot={compositionRoot}
        selection={selection}
        onChangeNodeConfig={onChangeSelectedAssetConfig}
        onChangeSelection={onChangeSelection}
      />
    </section>
  );
}
