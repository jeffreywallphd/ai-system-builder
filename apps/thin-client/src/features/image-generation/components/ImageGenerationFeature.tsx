import { formatImageGenerationModelDropdownLabel } from "../../../../../../modules/ui/shared";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

export function ImageGenerationFeature({
  onGenerated,
  onNavigateToArtifacts,
  onNavigateToModels,
}: {
  onGenerated?: () => void;
  onNavigateToArtifacts?: () => void;
  onNavigateToModels?: () => void;
} = {}) {
  const feature = useImageGenerationFeature(undefined, () => onGenerated?.());
  const selectedModelDownloaded = feature.selectedModelRecord
    ? ["downloaded", "generated", "validated"].includes(feature.selectedModelRecord.lifecycleStatus)
    : false;

  const setFormValue = (key: keyof typeof feature.form, value: string) => {
    feature.setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="ui-panel ui-stack ui-stack--sm" aria-label="Image Generation">
      <h2>Image Generation</h2>
      <p className="ui-text-muted">Generate images from a prompt. Save the generation to register it in Artifacts.</p>

      <section className="ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-model-record">Model (server inventory)</label>
          <div>
            <select
              className="ui-input"
              id="image-generation-model-record"
              value={feature.selectedModelRecordId}
              onChange={(event) => feature.setSelectedModelRecordId((event.target as HTMLSelectElement).value)}
            >
              <option value="">Select a server model...</option>
              <optgroup label="Downloaded image models">
                {feature.downloadedImageGenerationModels.map((model) => (
                  <option key={model.modelRecordId} value={model.modelRecordId}>
                    {formatImageGenerationModelDropdownLabel(model)}
                  </option>
                ))}
              </optgroup>
              {feature.referenceOnlyImageGenerationModels.length > 0 ? (
                <optgroup label="Saved references / download required">
                  {feature.referenceOnlyImageGenerationModels.map((model) => (
                    <option key={model.modelRecordId} value={model.modelRecordId}>
                      {formatImageGenerationModelDropdownLabel(model, true)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>{" "}
            <button type="button" className="ui-button" onClick={() => void feature.refreshModelInventory()} disabled={feature.modelInventoryLoading}>
              Refresh Models
            </button>
          </div>
          {feature.modelInventoryLoading ? <p className="ui-text-muted">Loading model inventory...</p> : null}
          {feature.modelInventoryError ? <p role="alert">{feature.modelInventoryError}</p> : null}
          {feature.downloadedImageGenerationModels.length === 0 ? (
            <p className="ui-text-muted" role="note">
              No downloaded image models found. You can still generate with a server default checkpoint or the manual override below if configured. Download one on the
              Models page for predictable results.{" "}
              {onNavigateToModels ? (
                <button type="button" className="ui-button" onClick={() => onNavigateToModels()}>
                  Open Models
                </button>
              ) : null}
            </p>
          ) : null}
          {feature.selectedModelRecord ? (
            <p role="note">
              Selected model status: <strong>{feature.selectedModelRecord.lifecycleStatus}</strong>
              {!selectedModelDownloaded ? " (reference only; download before generating)." : " (available locally)."}
            </p>
          ) : null}
        </div>

        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-runtime-mode">Runtime mode</label>
          <select
            className="ui-input"
            id="image-generation-runtime-mode"
            value={feature.runtimeMode}
            onChange={(event) => feature.setRuntimeMode((event.target as HTMLSelectElement).value as typeof feature.runtimeMode)}
          >
            <option value="auto">Auto</option>
            <option value="cpu">CPU</option>
            <option value="cuda">CUDA</option>
            <option value="directml">DirectML</option>
          </select>
        </div>

        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-latent-source">Latent source</label>
          <div>
            <select
              className="ui-input"
              id="image-generation-latent-source"
              value={feature.form.latentSourceArtifactId}
              onChange={(event) => setFormValue("latentSourceArtifactId", (event.target as HTMLSelectElement).value)}
            >
              <option value="">Empty latent image</option>
              {feature.imageArtifacts.map((artifact) => (
                <option key={artifact.storageKey} value={artifact.storageKey}>
                  {artifact.originalName ?? artifact.storageKey}
                </option>
              ))}
            </select>{" "}
            <button type="button" className="ui-button" onClick={() => void feature.refreshImageArtifacts()} disabled={feature.imageArtifactsLoading}>
              Refresh Images
            </button>
          </div>
          {feature.imageArtifactsError ? <p role="alert">{feature.imageArtifactsError}</p> : null}
        </div>
        <label className="ui-stack ui-stack--xs">
          <span>Enable FaceID (optional)</span>
          <input type="checkbox" checked={feature.form.faceIdEnabled} onChange={(event) => feature.setForm((current) => ({ ...current, faceIdEnabled: event.target.checked }))} />
        </label>
        {feature.form.faceIdEnabled ? (
          <div className="ui-stack ui-stack--xs">
            <p className="ui-text-muted">FaceID supports 1-3 image artifacts. You can reuse the same artifact in multiple slots.</p>
            <label className="ui-stack ui-stack--xs"><span>Face reference image 1</span><select className="ui-input" value={feature.form.faceIdArtifactId1} onChange={(event) => setFormValue("faceIdArtifactId1", (event.target as HTMLSelectElement).value)}><option value="">Select image artifact</option>{feature.imageArtifacts.map((artifact) => <option key={`face1-${artifact.storageKey}`} value={artifact.storageKey}>{artifact.originalName ?? artifact.storageKey}</option>)}</select></label>
            <label className="ui-stack ui-stack--xs"><span>Face reference image 2 (optional)</span><select className="ui-input" value={feature.form.faceIdArtifactId2} onChange={(event) => setFormValue("faceIdArtifactId2", (event.target as HTMLSelectElement).value)}><option value="">Select image artifact</option>{feature.imageArtifacts.map((artifact) => <option key={`face2-${artifact.storageKey}`} value={artifact.storageKey}>{artifact.originalName ?? artifact.storageKey}</option>)}</select></label>
            <label className="ui-stack ui-stack--xs"><span>Face reference image 3 (optional)</span><select className="ui-input" value={feature.form.faceIdArtifactId3} onChange={(event) => setFormValue("faceIdArtifactId3", (event.target as HTMLSelectElement).value)}><option value="">Select image artifact</option>{feature.imageArtifacts.map((artifact) => <option key={`face3-${artifact.storageKey}`} value={artifact.storageKey}>{artifact.originalName ?? artifact.storageKey}</option>)}</select></label>
            <label className="ui-stack ui-stack--xs"><span>Face identity strength</span><input className="ui-input" type="number" step="0.01" value={feature.form.faceIdIdentityStrength} onInput={(event) => setFormValue("faceIdIdentityStrength", (event.target as HTMLInputElement).value)} /></label>
            <label className="ui-stack ui-stack--xs"><span>Face structure strength</span><input className="ui-input" type="number" step="0.01" value={feature.form.faceIdStructureStrength} onInput={(event) => setFormValue("faceIdStructureStrength", (event.target as HTMLInputElement).value)} /></label>
            <label className="ui-stack ui-stack--xs"><span>Face noise</span><input className="ui-input" type="number" step="0.01" value={feature.form.faceIdNoise} onInput={(event) => setFormValue("faceIdNoise", (event.target as HTMLInputElement).value)} /></label>
          </div>
        ) : null}

        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-prompt">Prompt</label>
          <textarea
            className="ui-input ui-textarea"
            id="image-generation-prompt"
            value={feature.form.prompt}
            onInput={(event) => setFormValue("prompt", (event.target as HTMLTextAreaElement).value)}
          />
        </div>

        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-negativePrompt">Negative Prompt (optional)</label>
          <textarea
            className="ui-input ui-textarea"
            id="image-generation-negativePrompt"
            value={feature.form.negativePrompt}
            onInput={(event) => setFormValue("negativePrompt", (event.target as HTMLTextAreaElement).value)}
          />
        </div>

        {[
          ["seed", "Seed (optional)", "number"],
          ["width", "Width", "number"],
          ["height", "Height", "number"],
          ["steps", "Steps", "number"],
          ["cfg", "CFG", "number"],
          ["sampler", "Sampler", "text"],
          ["scheduler", "Scheduler", "text"],
          ["numImages", "Number of Images", "number"],
          ["outputFileName", "Output File Name (optional)", "text"],
        ].map(([key, label, type]) => {
          const formKey = key as keyof typeof feature.form;
          const id = `image-generation-${String(key)}`;
          return (
            <div key={id} className="ui-stack ui-stack--xs">
              <label htmlFor={id}>{label}</label>
              <input
                className="ui-input"
                id={id}
                type={type}
                value={feature.form[formKey]}
                onInput={(event) => setFormValue(formKey, (event.target as HTMLInputElement).value)}
              />
            </div>
          );
        })}

        <div className="ui-stack ui-stack--xs">
          <label htmlFor="image-generation-denoise">Denoise</label>
          <input
            className="ui-input"
            id="image-generation-denoise"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={feature.form.denoise}
            onInput={(event) => setFormValue("denoise", (event.target as HTMLInputElement).value)}
          />
          <output htmlFor="image-generation-denoise">{feature.form.denoise}</output>
        </div>

        <details>
          <summary>Advanced: Manual model/checkpoint override (optional)</summary>
          <div className="ui-stack ui-stack--xs">
            <label htmlFor="image-generation-model">Manual model/checkpoint</label>
            <input
              className="ui-input"
              id="image-generation-model"
              type="text"
              value={feature.form.model}
              onInput={(event) => setFormValue("model", (event.target as HTMLInputElement).value)}
              placeholder="checkpoint.safetensors or model record id"
            />
          </div>
        </details>
      </section>

      {feature.qualityNote ? <p role="note">{feature.qualityNote}</p> : null}
      {feature.validationError ? <p role="alert">{feature.validationError}</p> : null}

      <div className="ui-grid ui-grid--two">
        <button className="ui-button" type="button" onClick={() => void feature.start()} disabled={feature.isGenerateDisabled}>
          Generate
        </button>{" "}
        <button className="ui-button" type="button" onClick={() => void feature.cancel()} disabled={feature.isCancelDisabled}>
          Cancel
        </button>{" "}
        <button className="ui-button" type="button" onClick={() => onNavigateToArtifacts?.()}>
          Open Artifacts
        </button>
        <button className="ui-button" type="button" onClick={() => void feature.unloadModel()} disabled={feature.isUnloadModelDisabled}>
          {feature.unloadModelState.status === "loading" ? "Unloading model..." : "Unload model"}
        </button>
      </div>
      {feature.unloadModelState.message ? (
        <p role={feature.unloadModelState.status === "error" ? "alert" : "status"}>{feature.unloadModelState.message}</p>
      ) : null}

      <h3>Status</h3>
      <p>
        <strong>{feature.status}</strong>
      </p>
      <ul>
        <li>Memory: <strong>{feature.runtimeResources.memoryUsagePercent.toFixed(1)}%</strong></li>
        <li>CPU: <strong>{feature.runtimeResources.cpuUsagePercent.toFixed(1)}%</strong></li>
        <li>GPU: <strong>{feature.runtimeResources.gpuUsagePercent.toFixed(1)}%</strong></li>
      </ul>
      {feature.requestId ? <p>Request ID: {feature.requestId}</p> : null}
      {feature.error ? <p role="alert">{feature.error}</p> : null}
      {feature.status === "succeeded" ? <button className="ui-button" type="button" onClick={() => { const name = window.prompt("Name this image generation"); if (name) void feature.saveGeneration(name); }}>Save Generation</button> : null}

      <h3>Generated Images</h3>
      <div className="ui-stack ui-stack--sm">
        {feature.runtimeOutputPreviews.map((preview) => (
          <article key={`runtime-${preview.url}`} className="ui-stack ui-stack--xs">
            <img src={preview.url} alt={`Generated runtime image ${preview.fileName}`} />
            <p>{preview.fileName}</p>
          </article>
        ))}
        {feature.results.map((asset) => (
          <article key={asset.assetId} className="ui-stack ui-stack--xs">
            <img src={feature.createPreviewUrl(asset.storageKey)} alt={`Generated image ${asset.assetId}`} />
            <p>{asset.assetId}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
