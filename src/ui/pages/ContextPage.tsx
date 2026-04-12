import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PageTabs from "../components/navigation/PageTabs";
import ContextEngineeringLibrary from "../components/context/ContextEngineeringLibrary";
import FineTuningDatasetStudio from "../components/tuning-datasets/FineTuningDatasetStudio";

type ContextWorkspaceTab = "context-engineering" | "fine-tuning-dataset";

function normalizeTab(value: string | null): ContextWorkspaceTab {
  return value === "fine-tuning-dataset" ? "fine-tuning-dataset" : "context-engineering";
}

export default function ContextPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  const tabs = useMemo(
    () => [
      {
        id: "context-engineering",
        label: "Context Engineering",
        description: "Preserve reusable instruction packs and prompt-pack authoring workflows.",
      },
      {
        id: "fine-tuning-dataset",
        label: "Fine-Tuning Dataset",
        description: "Create, validate, review, version, and export supervised-tuning datasets.",
      },
    ],
    [],
  );

  return (
    <section className="ui-page" data-testid="context-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Context</h1>
          <p className="ui-page__subtitle">
            Work across reusable context engineering assets and governed fine-tuning datasets from one authoring surface.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Context Engineering preserves the existing prompt-pack workflow, while Fine-Tuning Dataset Studio delivers an end-to-end generative QA dataset pipeline.
          </p>
        </div>
      </div>

      <PageTabs
        label="Context workspace tabs"
        tabs={tabs}
        activeTabId={activeTab}
        onChange={(tabId) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", tabId);
          setSearchParams(next, { replace: true });
        }}
      />

      <section
        id="page-tabpanel-context-engineering"
        role="tabpanel"
        aria-labelledby="page-tab-context-engineering"
        className="ui-page-tab-panel"
        hidden={activeTab !== "context-engineering"}
      >
        <ContextEngineeringLibrary />
      </section>

      <section
        id="page-tabpanel-fine-tuning-dataset"
        role="tabpanel"
        aria-labelledby="page-tab-fine-tuning-dataset"
        className="ui-page-tab-panel"
        hidden={activeTab !== "fine-tuning-dataset"}
      >
        <FineTuningDatasetStudio />
      </section>
    </section>
  );
}
