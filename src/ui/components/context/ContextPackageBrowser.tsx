import type { IContextPackageSummary } from "@application/ports/interfaces/IContextPackageRepository";
import type { IContextPackage } from "@application/context/models/ContextPackage";
import ContextPackageCard from "./ContextPackageCard";
import ContextPackageEditor, { type ContextPackageEditorSubmitDraft } from "./ContextPackageEditor";

export interface ContextPackageBrowserProps {
  readonly packages: ReadonlyArray<IContextPackageSummary>;
  readonly selectedPackage?: IContextPackage;
  readonly selectedPackageId?: string;
  readonly searchQuery: string;
  readonly searchTagsText: string;
  readonly isLoading?: boolean;
  readonly isMutating?: boolean;
  readonly error?: string;
  readonly onSearchQueryChange?: (query: string) => void;
  readonly onSearchTagsChange?: (tagsText: string) => void;
  readonly onSearch?: () => void;
  readonly onClearSearch?: () => void;
  readonly onSelectPackage?: (contextPackageId: string) => void;
  readonly onCreatePackage?: (draft: ContextPackageEditorSubmitDraft) => void;
  readonly onUpdatePackage?: (contextPackageId: string, draft: ContextPackageEditorSubmitDraft) => void;
  readonly onDeletePackage?: (contextPackageId: string) => void;
}

export default function ContextPackageBrowser({
  packages,
  selectedPackage,
  selectedPackageId,
  searchQuery,
  searchTagsText,
  isLoading = false,
  isMutating = false,
  error,
  onSearchQueryChange,
  onSearchTagsChange,
  onSearch,
  onClearSearch,
  onSelectPackage,
  onCreatePackage,
  onUpdatePackage,
  onDeletePackage,
}: ContextPackageBrowserProps): JSX.Element {
  return (
    <div className="ui-context-browser">
      <aside className="ui-context-browser__sidebar">
        <div className="ui-card">
          <div className="ui-card__body ui-context-browser__search">
            <h2>Context library</h2>
            <p className="ui-text-secondary">Search reusable context by name, tags, and description.</p>

            <label className="ui-field">
              <span className="ui-label">Search packages</span>
              <input
                className="ui-input"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange?.(event.target.value)}
                placeholder="Search by package name or description"
              />
            </label>

            <label className="ui-field">
              <span className="ui-label">Filter tags</span>
              <input
                className="ui-input"
                value={searchTagsText}
                onChange={(event) => onSearchTagsChange?.(event.target.value)}
                placeholder="persona, support"
              />
            </label>

            <div className="ui-page__actions">
              <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={onSearch}>
                Search
              </button>
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={onClearSearch}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="ui-card">
            <div className="ui-card__body">
              <p className="ui-text-secondary">Unable to load context packages: {error}</p>
            </div>
          </div>
        ) : null}

        <div className="ui-context-browser__list">
          {packages.length > 0 ? (
            packages.map((contextPackage) => (
              <ContextPackageCard
                key={contextPackage.id}
                contextPackage={contextPackage}
                isSelected={contextPackage.id === selectedPackageId}
                onSelect={onSelectPackage}
              />
            ))
          ) : (
            <div className="ui-card">
              <div className="ui-card__body ui-empty-state">
                <h3>No context packages yet</h3>
                <p className="ui-text-secondary">
                  Create a reusable package for personas, instructions, reference notes, or formatting constraints.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="ui-context-browser__editor">
        {isLoading ? (
          <div className="ui-card">
            <div className="ui-card__body">
              <p className="ui-text-secondary">Loading context libraryâ€¦</p>
            </div>
          </div>
        ) : null}

        <ContextPackageEditor
          contextPackage={selectedPackage}
          isSaving={isMutating}
          onCreate={onCreatePackage}
          onUpdate={onUpdatePackage}
          onDelete={onDeletePackage}
        />
      </section>
    </div>
  );
}

