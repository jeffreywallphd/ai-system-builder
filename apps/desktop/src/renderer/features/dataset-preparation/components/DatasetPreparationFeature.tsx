import { useEffect, useState } from "react";

import { getDesktopApi, type DesktopArtifactBrowseItem } from "../../../lib/desktopApi";
import {
  createDesktopDatasetPreparationClient,
  type DesktopDatasetPreparationClient,
} from "../api/desktopDatasetPreparationClient";

export interface DatasetPreparationFeatureProps {
  onPrepared?: () => void;
  client?: DesktopDatasetPreparationClient;
}

export function DatasetPreparationFeature({ onPrepared, client }: DatasetPreparationFeatureProps) {
  const datasetClient = client ?? createDesktopDatasetPreparationClient();
  const [artifacts, setArtifacts] = useState<DesktopArtifactBrowseItem[]>([]);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [template, setTemplate] = useState("Prompt: {{text}}");
  const [trainRatio, setTrainRatio] = useState("0.8");
  const [testRatio, setTestRatio] = useState("0.2");
  const [seed, setSeed] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [outputFormat, setOutputFormat] = useState<"jsonl" | "json" | "csv">("jsonl");
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "success" | "error"; message?: string }>({ kind: "idle" });
  const [resultSummary, setResultSummary] = useState<{ trainKey: string; testKey: string; trainRows: number; testRows: number }>();

  useEffect(() => {
    void getDesktopApi().browseArtifacts().then((response) => {
      if (response && typeof response === "object" && "ok" in response && response.ok) {
        const items = ((response as { value?: { items?: DesktopArtifactBrowseItem[] } }).value?.items) ?? [];
        setArtifacts(items);
      }
    });
  }, []);

  const onToggleArtifact = (artifactId: string) => {
    setSelectedArtifactIds((current) =>
      current.includes(artifactId)
        ? current.filter((id) => id !== artifactId)
        : [...current, artifactId]);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "loading", message: "Preparing templated train/test datasets..." });
    setResultSummary(undefined);

    const response = await datasetClient.prepareTemplatedDatasetFromArtifacts({
      sourceArtifactIds: selectedArtifactIds,
      template,
      split: {
        trainRatio: Number(trainRatio),
        testRatio: Number(testRatio),
        seed: seed ? Number(seed) : undefined,
      },
      shuffle,
      outputFormat,
    });

    if (!response.ok) {
      setStatus({ kind: "error", message: response.error.message });
      return;
    }

    setStatus({ kind: "success", message: "Templated train/test datasets are ready." });
    setResultSummary({
      trainKey: response.value.train.storage.key,
      testKey: response.value.test.storage.key,
      trainRows: response.value.trainRowCount,
      testRows: response.value.testRowCount,
    });
    const artifactsResponse = await getDesktopApi().browseArtifacts();
    if (artifactsResponse && typeof artifactsResponse === "object" && "ok" in artifactsResponse && artifactsResponse.ok) {
      setArtifacts(((artifactsResponse as { value?: { items?: DesktopArtifactBrowseItem[] } }).value?.items) ?? []);
    }
    onPrepared?.();
  };

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Dataset Preparation</h2>
      <p>Prepare templated train/test datasets from selected artifacts.</p>
      <form className="ui-stack ui-stack--sm" onSubmit={(event) => void onSubmit(event)}>
        <section className="ui-stack ui-stack--sm">
          <h3>Source artifacts</h3>
          {artifacts.length === 0 ? <p>No artifacts available yet.</p> : artifacts.map((artifact) => (
            <label key={artifact.storageKey}>
              <input
                type="checkbox"
                checked={selectedArtifactIds.includes(artifact.storageKey)}
                onChange={() => onToggleArtifact(artifact.storageKey)}
              />
              {artifact.originalName ?? artifact.storageKey}
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
          {status.kind === "loading" ? "Preparing..." : "Prepare train/test datasets"}
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
