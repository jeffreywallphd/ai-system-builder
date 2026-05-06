import { ArtifactBrowserFeature } from "../features/artifact-browser";
import { ArtifactIngestionFeature } from "../features/artifact-upload";
import { TabbedPanel } from "../components/ui/TabbedPanel";

export function ArtifactsPage() {
  return (
    <section className="ui-stack ui-stack--sm">
      <TabbedPanel
        tabListAriaLabel="Artifact workspace panels"
        defaultTabId="ingestion"
        tabs={[
          {
            id: "ingestion",
            label: "Artifact Ingestion",
            content: <ArtifactIngestionFeature />,
          },
          {
            id: "browser",
            label: "Artifact Browser",
            content: <ArtifactBrowserFeature />,
          },
        ]}
      />
    </section>
  );
}

