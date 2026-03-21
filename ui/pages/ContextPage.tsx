import { useEffect, useState } from "react";
import ContextPackageCard from "../components/context/ContextPackageCard";
import ContextPackageEditor from "../components/context/ContextPackageEditor";
import PageTabs from "../components/navigation/PageTabs";
import { useUiDependencies } from "../composition/AppProviders";
import type { ContextStoreState } from "../state/ContextStore";

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

export default function ContextPage(): JSX.Element {
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
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Reusable Instructions</h1>
          <p className="ui-page__subtitle">
            Save helpful AI instructions, examples, and reference notes as reusable prompt packs your team can find, edit, and reuse across workflows.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Use the library tab to find saved prompt packs, then switch to the create tab when you want to write a new pack or update the one you selected.
          </p>
        </div>
      </div>

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
                      <strong>Reusable sections</strong>
                      {state.selectedPackage.fragments.map((fragment) => (
                        <article key={fragment.id} className="ui-card">
                          <div className="ui-card__body ui-stack ui-stack--2xs">
                            <div className="ui-row ui-row--between ui-row--wrap">
                              <strong>{fragment.title || fragment.id}</strong>
                              <span className="ui-badge ui-badge--neutral">{friendlyFragmentKind(fragment.kind)}</span>
                            </div>
                            <p className="ui-text-secondary">{fragment.content || "No content written yet."}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ui-empty-state">
                    <h2>Pick a prompt pack</h2>
                    <p className="ui-text-secondary">
                      Select a saved pack on the left to review its instructions here, or switch to Create Pack to start from scratch.
                    </p>
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
          <p className="ui-text-secondary">
            Create a new prompt pack or update the one you selected from the library.
          </p>
          {state.selectedPackage ? (
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => contextStore.selectPackage(undefined)}
            >
              Start a new pack
            </button>
          ) : null}
        </div>

        <ContextPackageEditor
          contextPackage={state.selectedPackage}
          isSaving={state.isMutating}
          onCreate={(draft) => {
            void contextStore.createPackage(draft).catch(() => undefined);
          }}
          onUpdate={(contextPackageId, draft) => {
            void contextStore.updatePackage({ contextPackageId, ...draft }).catch(() => undefined);
          }}
          onDelete={(contextPackageId) => {
            void contextStore.deletePackage(contextPackageId).catch(() => undefined);
          }}
        />
      </section>
    </section>
  );
}

function friendlyFragmentKind(kind: string): string {
  switch (kind) {
    case "instructions":
      return "Instructions";
    case "persona":
      return "Voice & tone";
    case "domain-notes":
      return "Reference notes";
    case "retrieved-context":
      return "Retrieved info";
    case "examples":
      return "Examples";
    case "memory-snippets":
      return "Saved memories";
    case "formatting-constraints":
      return "Formatting rules";
    default:
      return kind;
  }
}
