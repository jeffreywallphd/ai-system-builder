import { useEffect, useState } from "react";
import ContextPackageCard from "./ContextPackageCard";
import ContextPackageEditor from "./ContextPackageEditor";
import PageTabs from "../navigation/PageTabs";
import { useUiDependencies } from "../../composition/AppProviders";
import type { ContextStoreState } from "../../state/ContextStore";

type ContextTabId = "find" | "create";

const fallbackState: ContextStoreState = Object.freeze({
  packages: Object.freeze([]),
  recipes: Object.freeze([]),
  selectedPackageId: undefined,
  selectedPackage: undefined,
  searchQuery: "",
  searchTags: Object.freeze([]),
  isLoadingList: false,
  isLoadingSelected: false,
  isMutating: false,
  error: undefined,
});

function parseTags(value: string): ReadonlyArray<string> {
  return Object.freeze([...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))]);
}

export default function ContextEngineeringLibrary(): JSX.Element {
  const { contextStore } = useUiDependencies();
  const [state, setState] = useState<ContextStoreState>(() => contextStore.getState() || fallbackState);
  const [searchQuery, setSearchQuery] = useState(state.searchQuery);
  const [searchTagsText, setSearchTagsText] = useState(state.searchTags.join(", "));
  const [activeTab, setActiveTab] = useState<ContextTabId>("find");

  useEffect(() => contextStore.subscribe(setState), [contextStore]);

  useEffect(() => {
    void contextStore.initialize().catch(() => undefined);
  }, [contextStore]);

  useEffect(() => {
    setSearchQuery(state.searchQuery);
    setSearchTagsText(state.searchTags.join(", "));
  }, [state.searchQuery, state.searchTags]);

  return (
    <section className="ui-stack ui-stack--md" data-testid="context-engineering-tab">
      <PageTabs
        label="Reusable instructions tabs"
        tabs={[
          {
            id: "find",
            label: "Find Packs",
            description: "Search saved prompt packs and inspect their contents.",
          },
          {
            id: "create",
            label: state.selectedPackage ? "Edit Pack" : "Create Pack",
            description: "Write a new prompt pack or update the selected one.",
          },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as ContextTabId)}
      />

      <section
        id="page-tabpanel-find"
        role="tabpanel"
        aria-labelledby="page-tab-find"
        className="ui-page-tab-panel"
        hidden={activeTab !== "find"}
      >
        <div className="ui-context-browser">
          <aside className="ui-context-browser__sidebar">
            <div className="ui-card">
              <div className="ui-card__body ui-context-browser__search">
                <h2>Prompt pack library</h2>
                <p className="ui-text-secondary">
                  Search by pack name, plain-language description, or tags your team already uses.
                </p>

                <label className="ui-field">
                  <span className="ui-label">Search packs</span>
                  <input
                    className="ui-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Customer support tone, onboarding notes"
                  />
                </label>

                <label className="ui-field">
                  <span className="ui-label">Filter by tags</span>
                  <input
                    className="ui-input"
                    value={searchTagsText}
                    onChange={(event) => setSearchTagsText(event.target.value)}
                    placeholder="support, legal, brand"
                  />
                </label>

                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    onClick={() => {
                      void contextStore
                        .search({ query: searchQuery, tags: parseTags(searchTagsText) })
                        .catch(() => undefined);
                    }}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchTagsText("");
                      void contextStore.clearSearch().catch(() => undefined);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {state.error ? (
              <div className="ui-card">
                <div className="ui-card__body">
                  <p className="ui-text-secondary">Unable to load prompt packs: {state.error}</p>
                </div>
              </div>
            ) : null}

            <div className="ui-context-browser__list">
              {state.packages.length > 0 ? (
                state.packages.map((contextPackage) => (
                  <ContextPackageCard
                    key={contextPackage.id}
                    contextPackage={contextPackage}
                    isSelected={contextPackage.id === state.selectedPackageId}
                    onSelect={(contextPackageId) => {
                      void contextStore.selectPackage(contextPackageId).catch(() => undefined);
                    }}
                  />
                ))
              ) : (
                <div className="ui-card">
                  <div className="ui-card__body ui-empty-state">
                    <h3>No prompt packs yet</h3>
                    <p className="ui-text-secondary">
                      Create a pack for reusable instructions, brand voice, examples, or reference notes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="ui-context-browser__editor">
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                {state.isLoadingList || state.isLoadingSelected ? (
                  <p className="ui-text-secondary">Loading prompt pack details…</p>
                ) : null}

                {state.selectedPackage ? (
                  <>
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <div className="ui-stack ui-stack--2xs">
                        <h2>{state.selectedPackage.name}</h2>
                        <p className="ui-text-secondary">
                          {state.selectedPackage.description || "No description yet."}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="ui-button ui-button--primary ui-button--sm"
                        onClick={() => setActiveTab("create")}
                      >
                        Edit Pack
                      </button>
                    </div>

                    <div className="ui-meta-grid">
                      <div className="ui-meta-item">
                        <span className="ui-meta-label">Pack id</span>
                        <span className="ui-meta-value">{state.selectedPackage.id}</span>
                      </div>
                      <div className="ui-meta-item">
                        <span className="ui-meta-label">Version</span>
                        <span className="ui-meta-value">{state.selectedPackage.version || "Not set"}</span>
                      </div>
                      <div className="ui-meta-item">
                        <span className="ui-meta-label">Tags</span>
                        <span className="ui-meta-value">
                          {state.selectedPackage.tags.length > 0 ? state.selectedPackage.tags.join(", ") : "No tags yet"}
                        </span>
                      </div>
                      <div className="ui-meta-item">
                        <span className="ui-meta-label">Reusable sections</span>
                        <span className="ui-meta-value">{state.selectedPackage.fragments.length}</span>
                      </div>
                    </div>

                    <div className="ui-stack ui-stack--sm">
                      {state.selectedPackage.fragments.map((fragment) => (
                        <article key={fragment.id} className="ui-card">
                          <div className="ui-card__body ui-stack ui-stack--2xs">
                            <div className="ui-row ui-row--between ui-row--wrap">
                              <strong>{fragment.title || fragment.kind}</strong>
                              <span className="ui-text-secondary ui-text-small">{fragment.kind}</span>
                            </div>
                            <p className="ui-text-secondary" style={{ whiteSpace: "pre-wrap" }}>{fragment.content}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ui-empty-state">
                    <h3>Select a prompt pack</h3>
                    <p className="ui-text-secondary">Choose a reusable instruction pack to inspect its sections or start a new one.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section
        id="page-tabpanel-create"
        role="tabpanel"
        aria-labelledby="page-tab-create"
        className="ui-page-tab-panel"
        hidden={activeTab !== "create"}
      >
        <div className="ui-row ui-row--between ui-row--wrap">
          <div>
            <h2>{state.selectedPackage ? "Edit prompt pack" : "Create prompt pack"}</h2>
            <p className="ui-text-secondary">
              Build a reusable prompt pack with instructions, examples, references, and other context fragments your team can share.
            </p>
          </div>
        </div>

        <ContextPackageEditor
          contextPackage={state.selectedPackage}
          isSaving={state.isMutating}
          onCreate={(request) => {
            void contextStore.createPackage(request).catch(() => undefined);
          }}
          onUpdate={(contextPackageId, request) => {
            void contextStore.updatePackage({
              contextPackageId,
              ...request,
            }).catch(() => undefined);
          }}
          onDelete={(contextPackageId) => {
            void contextStore.deletePackage(contextPackageId).catch(() => undefined);
          }}
        />
      </section>
    </section>
  );
}
