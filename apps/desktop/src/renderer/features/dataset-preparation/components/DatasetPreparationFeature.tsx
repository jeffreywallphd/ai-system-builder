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
    unsupportedDocumentPolicy,
    normalizationMode,
    chunkSize,
    chunkOverlap,
    preserveDocumentBoundaries,
    maxChunkCount,
    modelId,
    modelDevice,
    modelTorchDtype,
    maxExamplesPerChunk,
    batchSize,
    failurePolicy,
    generationTemperature,
    generationTopP,
    generationMaxNewTokens,
    trainRatio,
    testRatio,
    seed,
    shuffle,
    outputFormat,
    outputBaseName,
    localDestinationEnabled,
    huggingFaceDestinationEnabled,
    huggingFaceRepository,
    huggingFaceRevision,
    huggingFacePathPrefix,
    status,
    resultSummary,
    onToggleArtifact,
    setTemplate,
    setUnsupportedDocumentPolicy,
    setNormalizationMode,
    setChunkSize,
    setChunkOverlap,
    setPreserveDocumentBoundaries,
    setMaxChunkCount,
    setModelId,
    setModelDevice,
    setModelTorchDtype,
    setMaxExamplesPerChunk,
    setBatchSize,
    setFailurePolicy,
    setGenerationTemperature,
    setGenerationTopP,
    setGenerationMaxNewTokens,
    setTrainRatio,
    setTestRatio,
    setSeed,
    setShuffle,
    setOutputFormat,
    setOutputBaseName,
    setLocalDestinationEnabled,
    setHuggingFaceDestinationEnabled,
    setHuggingFaceRepository,
    setHuggingFaceRevision,
    setHuggingFacePathPrefix,
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

        <section className="ui-stack ui-stack--sm">
          <h3>Normalization</h3>
          <div className="ui-grid ui-grid--two">
            <label className="ui-stack ui-stack--sm">
              <span>Unsupported document policy</span>
              <select
                className="ui-input"
                value={unsupportedDocumentPolicy}
                onChange={(event) => setUnsupportedDocumentPolicy(event.target.value as typeof unsupportedDocumentPolicy)}
              >
                <option value="">Runtime default</option>
                <option value="fail">Fail</option>
                <option value="skip">Skip</option>
              </select>
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Normalization mode</span>
              <select
                className="ui-input"
                value={normalizationMode}
                onChange={(event) => setNormalizationMode(event.target.value as typeof normalizationMode)}
              >
                <option value="">Runtime default</option>
                <option value="strict">Strict</option>
                <option value="best-effort">Best effort</option>
              </select>
            </label>
          </div>
        </section>

        <section className="ui-stack ui-stack--sm">
          <h3>Chunking</h3>
          <div className="ui-grid ui-grid--two">
            <label className="ui-stack ui-stack--sm">
              <span>Chunk size</span>
              <input className="ui-input" value={chunkSize} onChange={(event) => setChunkSize(event.target.value)} />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Chunk overlap</span>
              <input className="ui-input" value={chunkOverlap} onChange={(event) => setChunkOverlap(event.target.value)} />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Max chunk count (optional)</span>
              <input className="ui-input" value={maxChunkCount} onChange={(event) => setMaxChunkCount(event.target.value)} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={preserveDocumentBoundaries}
                onChange={(event) => setPreserveDocumentBoundaries(event.target.checked)}
              />
              Preserve document boundaries
            </label>
          </div>
        </section>

        <section className="ui-stack ui-stack--sm">
          <h3>Generation</h3>
          <div className="ui-grid ui-grid--two">
            <label className="ui-stack ui-stack--sm">
              <span>Model ID</span>
              <input className="ui-input" value={modelId} onChange={(event) => setModelId(event.target.value)} />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Model device</span>
              <select className="ui-input" value={modelDevice} onChange={(event) => setModelDevice(event.target.value as typeof modelDevice)}>
                <option value="">Runtime default</option>
                <option value="auto">Auto</option>
                <option value="cpu">CPU</option>
                <option value="cuda">CUDA</option>
              </select>
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Torch dtype</span>
              <select
                className="ui-input"
                value={modelTorchDtype}
                onChange={(event) => setModelTorchDtype(event.target.value as typeof modelTorchDtype)}
              >
                <option value="">Runtime default</option>
                <option value="auto">Auto</option>
                <option value="float16">float16</option>
                <option value="bfloat16">bfloat16</option>
                <option value="float32">float32</option>
              </select>
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Failure policy</span>
              <select className="ui-input" value={failurePolicy} onChange={(event) => setFailurePolicy(event.target.value as typeof failurePolicy)}>
                <option value="">Runtime default</option>
                <option value="fail">Fail</option>
                <option value="skip">Skip</option>
              </select>
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Max examples/chunk (optional)</span>
              <input className="ui-input" value={maxExamplesPerChunk} onChange={(event) => setMaxExamplesPerChunk(event.target.value)} />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Batch size (optional)</span>
              <input className="ui-input" value={batchSize} onChange={(event) => setBatchSize(event.target.value)} />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Temperature (optional)</span>
              <input
                className="ui-input"
                value={generationTemperature}
                onChange={(event) => setGenerationTemperature(event.target.value)}
              />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Top P (optional)</span>
              <input className="ui-input" value={generationTopP} onChange={(event) => setGenerationTopP(event.target.value)} />
            </label>
            <label className="ui-stack ui-stack--sm">
              <span>Max new tokens (optional)</span>
              <input
                className="ui-input"
                value={generationMaxNewTokens}
                onChange={(event) => setGenerationMaxNewTokens(event.target.value)}
              />
            </label>
          </div>
        </section>

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
            <option value="parquet">Parquet</option>
            <option value="jsonl">JSONL</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>
        <label className="ui-stack ui-stack--sm">
          <span>Output base name (optional)</span>
          <input className="ui-input" value={outputBaseName} onChange={(event) => setOutputBaseName(event.target.value)} />
        </label>

        <section className="ui-stack ui-stack--sm">
          <h3>Output destinations</h3>
          <label>
            <input
              type="checkbox"
              checked={localDestinationEnabled}
              onChange={(event) => setLocalDestinationEnabled(event.target.checked)}
            />
            Store locally
          </label>
          <label>
            <input
              type="checkbox"
              checked={huggingFaceDestinationEnabled}
              onChange={(event) => setHuggingFaceDestinationEnabled(event.target.checked)}
            />
            Publish to Hugging Face
          </label>
          {huggingFaceDestinationEnabled ? (
            <div className="ui-grid ui-grid--two">
              <label className="ui-stack ui-stack--sm">
                <span>Hugging Face repository</span>
                <input className="ui-input" value={huggingFaceRepository} onChange={(event) => setHuggingFaceRepository(event.target.value)} />
              </label>
              <label className="ui-stack ui-stack--sm">
                <span>Revision (optional)</span>
                <input className="ui-input" value={huggingFaceRevision} onChange={(event) => setHuggingFaceRevision(event.target.value)} />
              </label>
              <label className="ui-stack ui-stack--sm">
                <span>Path prefix (optional)</span>
                <input className="ui-input" value={huggingFacePathPrefix} onChange={(event) => setHuggingFacePathPrefix(event.target.value)} />
              </label>
            </div>
          ) : null}
        </section>

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
