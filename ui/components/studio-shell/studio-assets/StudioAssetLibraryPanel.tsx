import { useMemo, useState } from "react";
import StudioAssetInspectorPanel from "./StudioAssetInspectorPanel";
import type { StudioAssetCompositionNode } from "../../../studio-shell/studio-assets/StudioAssetComposition";
import type { StudioAssetRegistrationCategory, StudioAssetRegistry } from "../../../studio-shell/studio-assets/StudioAssetRegistry";
import { listStudioAssetLibrarySections, type StudioAssetLibraryEntry } from "../../../studio-shell/studio-assets/StudioAssetLibrary";

export interface StudioAssetLibraryPanelProps {
  readonly registry: StudioAssetRegistry;
  readonly title?: string;
  readonly description?: string;
  readonly categoryFilter?: ReadonlyArray<StudioAssetRegistrationCategory>;
  readonly onInsertAsset?: (entry: StudioAssetLibraryEntry) => void;
  readonly selectedAssetNode?: StudioAssetCompositionNode;
  readonly onChangeSelectedAssetConfig?: (nextConfig: Readonly<Record<string, unknown>>) => void;
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
  onChangeSelectedAssetConfig,
}: StudioAssetLibraryPanelProps): JSX.Element {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => listStudioAssetLibrarySections({
    registry,
    query: {
      searchText: query,
      categories: categoryFilter,
    },
  }), [registry, query, categoryFilter]);

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
                {section.entries.map((entry) => (
                  <li key={entry.id} className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                    <div className="ui-stack ui-stack--3xs" style={{ minWidth: "12rem" }}>
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
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <StudioAssetInspectorPanel
        registry={registry}
        selectedAssetNode={selectedAssetNode}
        onChangeNodeConfig={onChangeSelectedAssetConfig}
      />
    </section>
  );
}
