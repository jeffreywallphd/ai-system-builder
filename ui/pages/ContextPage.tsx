import { useEffect, useState } from "react";
import ContextPackageBrowser from "../components/context/ContextPackageBrowser";
import { useUiDependencies } from "../composition/AppProviders";
import type { ContextStoreState } from "../state/ContextStore";

const fallbackState: ContextStoreState = Object.freeze({
  packages: Object.freeze([]),
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
  const { contextStore, settingsStore } = useUiDependencies();
  const [state, setState] = useState<ContextStoreState>(() => contextStore.getState() || fallbackState);
  const [searchQuery, setSearchQuery] = useState(state.searchQuery);
  const [searchTagsText, setSearchTagsText] = useState(state.searchTags.join(", "));

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
          <h1 className="ui-page__title">Context</h1>
          <p className="ui-page__subtitle">
            Treat context as a reusable authoring asset: build packages, inspect fragments, and curate reusable prompt building blocks.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Browser-authored packages persist locally for this workspace session profile and complement the filesystem-backed context package foundation configured under <strong>{settingsStore.getSettings().workspace.workflowsDirectory}</strong>.
          </p>
        </div>
      </div>

      <ContextPackageBrowser
        packages={state.packages}
        selectedPackage={state.selectedPackage}
        selectedPackageId={state.selectedPackageId}
        searchQuery={searchQuery}
        searchTagsText={searchTagsText}
        isLoading={state.isLoadingList || state.isLoadingSelected}
        isMutating={state.isMutating}
        error={state.error}
        onSearchQueryChange={setSearchQuery}
        onSearchTagsChange={setSearchTagsText}
        onSearch={() => {
          void contextStore.search({ query: searchQuery, tags: parseTags(searchTagsText) }).catch(() => undefined);
        }}
        onClearSearch={() => {
          setSearchQuery("");
          setSearchTagsText("");
          void contextStore.clearSearch().catch(() => undefined);
        }}
        onSelectPackage={(contextPackageId) => {
          void contextStore.selectPackage(contextPackageId).catch(() => undefined);
        }}
        onCreatePackage={(draft) => {
          void contextStore.createPackage(draft).catch(() => undefined);
        }}
        onUpdatePackage={(contextPackageId, draft) => {
          void contextStore.updatePackage({ contextPackageId, ...draft }).catch(() => undefined);
        }}
        onDeletePackage={(contextPackageId) => {
          void contextStore.deletePackage(contextPackageId).catch(() => undefined);
        }}
      />
    </section>
  );
}
