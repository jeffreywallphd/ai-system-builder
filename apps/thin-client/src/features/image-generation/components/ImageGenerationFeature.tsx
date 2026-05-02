import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

export function ImageGenerationFeature({ onGenerated, onNavigateToArtifacts }: { onGenerated?: () => void; onNavigateToArtifacts?: () => void } = {}) {
  const f = useImageGenerationFeature(undefined, () => onGenerated?.());
  const set = (k: keyof typeof f.form, v: string) => f.setForm((x) => ({ ...x, [k]: v }));

  return (
    <section className="ui-stack ui-stack--md" aria-label="Image Generation">
      <h2>Image Generation</h2>
      <p>Generate images from a prompt. Final images are saved to Artifacts.</p>

      <div className="ui-stack ui-stack--sm">
        {[
          ["prompt", "Prompt", "text"], ["negativePrompt", "Negative Prompt (optional)", "text"], ["seed", "Seed (optional)", "number"],
          ["width", "Width", "number"], ["height", "Height", "number"], ["steps", "Steps", "number"], ["sampler", "Sampler", "text"],
          ["scheduler", "Scheduler", "text"], ["model", "Model / Checkpoint (optional)", "text"], ["numImages", "Number of Images", "number"],
        ].map(([key, label, type]) => {
          const id = `image-generation-${String(key)}`;
          return <div key={id} className="ui-stack ui-stack--xs"><label htmlFor={id}>{label}</label><input id={id} type={type} value={f.form[key as keyof typeof f.form]} onInput={(e) => set(key as keyof typeof f.form, (e.target as HTMLInputElement).value)} /></div>;
        })}
      </div>

      {f.qualityNote ? <p role="note">{f.qualityNote}</p> : null}
      {f.validationError ? <p role="alert">{f.validationError}</p> : null}

      <div>
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
