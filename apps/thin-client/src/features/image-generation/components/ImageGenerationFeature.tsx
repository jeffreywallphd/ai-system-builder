import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

function formatModelOption(model: { displayName: string; modelId?: string; provider: string; lifecycleStatus: string; artifactForm: string; inferenceMode?: string }, referenceOnly = false): string {
  return `${model.displayName}${model.modelId ? ` (${model.modelId})` : ""} · ${model.provider} · ${model.lifecycleStatus} · ${model.artifactForm}${model.inferenceMode ? ` · ${model.inferenceMode}` : ""}${referenceOnly ? " · reference only" : ""}`;
}

export function ImageGenerationFeature({ onGenerated, onNavigateToArtifacts, onNavigateToModels }: { onGenerated?: () => void; onNavigateToArtifacts?: () => void; onNavigateToModels?: () => void } = {}) {
  const f = useImageGenerationFeature(undefined, () => onGenerated?.());
  const set = (k: keyof typeof f.form, v: string) => f.setForm((x) => ({ ...x, [k]: v }));
  const selectedModelDownloaded = f.selectedModelRecord ? ["downloaded", "generated"].includes(f.selectedModelRecord.lifecycleStatus) : false;

  return (
    <section className="ui-panel ui-stack ui-stack--sm" aria-label="Image Generation">
      <h2>Image Generation</h2>
      <p className="ui-text-muted">Generate images from a prompt. Final images are saved to Artifacts.</p>

      <section className="ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-model-record">Model (server inventory)</label>
          <div>
            <select className="ui-input" id="image-generation-model-record" value={f.selectedModelRecordId} onChange={(e) => f.setSelectedModelRecordId((e.target as HTMLSelectElement).value)}>
              <option value="">Select a server model…</option>
              <optgroup label="Downloaded image models">
                {f.downloadedImageGenerationModels.map((model) => <option key={model.modelRecordId} value={model.modelRecordId}>{formatModelOption(model)}</option>)}
              </optgroup>
              {f.referenceOnlyImageGenerationModels.length > 0 ? (
                <optgroup label="Saved references / may need download">
                  {f.referenceOnlyImageGenerationModels.map((model) => <option key={model.modelRecordId} value={model.modelRecordId}>{formatModelOption(model, true)}</option>)}
                </optgroup>
              ) : null}
            </select>{" "}
            <button type="button" className="ui-button" onClick={() => void f.refreshModelInventory()} disabled={f.modelInventoryLoading}>Refresh Models</button>
          </div>
          {f.modelInventoryLoading ? <p className="ui-text-muted">Loading model inventory…</p> : null}
          {f.modelInventoryError ? <p role="alert">{f.modelInventoryError}</p> : null}
          {f.downloadedImageGenerationModels.length === 0 ? <p className="ui-text-muted" role="note">No downloaded image models found. You can still generate with a server default checkpoint or the manual override below if configured. Download one on the Models page for predictable results. {onNavigateToModels ? <button type="button" className="ui-button" onClick={() => onNavigateToModels()}>Open Models</button> : null}</p> : null}
          {f.selectedModelRecord ? (
            <p role="note">
              Selected model status: <strong>{f.selectedModelRecord.lifecycleStatus}</strong>
              {!selectedModelDownloaded ? " (reference only; generation may fail until downloaded)." : " (available locally)."}
            </p>
          ) : null}
        </div>
        {[
          ["prompt", "Prompt", "text"], ["negativePrompt", "Negative Prompt (optional)", "text"], ["seed", "Seed (optional)", "number"],
          ["width", "Width", "number"], ["height", "Height", "number"], ["steps", "Steps", "number"], ["sampler", "Sampler", "text"],
          ["scheduler", "Scheduler", "text"], ["numImages", "Number of Images", "number"],
        ].map(([key, label, type]) => {
          const id = `image-generation-${String(key)}`;
          return <div key={id} className="ui-stack ui-stack--xs"><label htmlFor={id}>{label}</label><input className="ui-input" id={id} type={type} value={f.form[key as keyof typeof f.form]} onInput={(e) => set(key as keyof typeof f.form, (e.target as HTMLInputElement).value)} /></div>;
        })}
        <details>
          <summary>Advanced: Manual model/checkpoint override (optional)</summary>
          <div className="ui-stack ui-stack--xs">
            <label htmlFor="image-generation-model">Manual model/checkpoint</label>
            <input className="ui-input" id="image-generation-model" type="text" value={f.form.model} onInput={(e) => set("model", (e.target as HTMLInputElement).value)} placeholder="checkpoint.safetensors or model record id" />
          </div>
        </details>
      </section>

      {f.qualityNote ? <p role="note">{f.qualityNote}</p> : null}
      {f.validationError ? <p role="alert">{f.validationError}</p> : null}

      <div className="ui-grid ui-grid--two">
        <button className="ui-button" type="button" onClick={() => void f.start()} disabled={f.isGenerateDisabled}>Generate</button>{" "}
        <button className="ui-button" type="button" onClick={() => void f.cancel()} disabled={f.isCancelDisabled}>Cancel</button>{" "}
        <button className="ui-button" type="button" onClick={() => onNavigateToArtifacts?.()}>Open Artifacts</button>
      </div>

      <h3>Status</h3>
      <p><strong>{f.status}</strong></p>
      {f.requestId ? <p>Request ID: {f.requestId}</p> : null}
      {f.error ? <p role="alert">{f.error}</p> : null}

      <h3>Generated Images</h3>
      <div className="ui-stack ui-stack--sm">
        {f.results.map((asset) => (
          <article key={asset.assetId} className="ui-stack ui-stack--xs">
            <img src={f.createPreviewUrl(asset.storageKey)} alt={`Generated image ${asset.assetId}`} />
            <p>{asset.assetId}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
