import {
  type DesktopDatasetPreparationClient,
} from "../api/desktopDatasetPreparationClient";
import { useDatasetPreparationFeature } from "../hooks/useDatasetPreparationFeature";

export interface DatasetPreparationFeatureProps {
  onPrepared?: () => void;
  client?: DesktopDatasetPreparationClient;
}

export function DatasetPreparationFeature({ onPrepared, client }: DatasetPreparationFeatureProps) {
  const {
    artifacts,
    selectedArtifactIds,
    template,
    trainRatio,
    testRatio,
    seed,
    shuffle,
    outputFormat,
    status,
    resultSummary,
    onToggleArtifact,
    setTemplate,
    setTrainRatio,
    setTestRatio,
    setSeed,
    setShuffle,
    setOutputFormat,
    onSubmit,
  } = useDatasetPreparationFeature({
    client,
    onPrepared,
  });

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Dataset Preparation</h2>
      <p>Prepare training datasets from selected artifacts.</p>
      <form className="ui-stack ui-stack--sm" onSubmit={(event) => void onSubmit(event)}>
        <section className="ui-stack ui-stack--sm">
          <h3>Source artifacts</h3>
          {artifacts.length === 0 ? <p>No artifacts available yet.</p> : artifacts.map((artifact) => (
            <label key={artifact.artifactId}>
              <input
                type="checkbox"
                checked={selectedArtifactIds.includes(artifact.artifactId)}
                onChange={() => onToggleArtifact(artifact.artifactId)}
              />
              {artifact.label}
            </label>
          ))}
        </section>

        <label className="ui-stack ui-stack--sm">
          <span>Template</span>
          <textarea className="ui-input" value={template} onChange={(event) => setTemplate(event.target.value)} rows={3} />
        </label>

        <section className="ui-grid ui-grid--two">
          <label className="ui-stack ui-stack--sm">
            <span>Train ratio</span>
            <input className="ui-input" value={trainRatio} onChange={(event) => setTrainRatio(event.target.value)} />
          </label>
          <label className="ui-stack ui-stack--sm">
            <span>Test ratio</span>
            <input className="ui-input" value={testRatio} onChange={(event) => setTestRatio(event.target.value)} />
          </label>
          <label className="ui-stack ui-stack--sm">
            <span>Seed (optional)</span>
            <input className="ui-input" value={seed} onChange={(event) => setSeed(event.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
            Shuffle rows
          </label>
        </section>

        <label className="ui-stack ui-stack--sm">
          <span>Output format</span>
          <select className="ui-input" value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as typeof outputFormat)}>
            <option value="jsonl">JSONL</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>

        <button className="ui-button" type="submit" disabled={selectedArtifactIds.length === 0 || status.kind === "loading"}>
          {status.kind === "loading" ? "Preparing..." : "Prepare training dataset"}
        </button>
      </form>

      {status.message ? <p role={status.kind === "error" ? "alert" : "status"}>{status.message}</p> : null}
      {resultSummary ? (
        <dl className="ui-grid ui-grid--two">
          <dt>Train artifact</dt>
          <dd>{resultSummary.trainKey}</dd>
          <dt>Test artifact</dt>
          <dd>{resultSummary.testKey}</dd>
          <dt>Train rows</dt>
          <dd>{resultSummary.trainRows}</dd>
          <dt>Test rows</dt>
          <dd>{resultSummary.testRows}</dd>
        </dl>
      ) : null}
    </section>
  );
}
