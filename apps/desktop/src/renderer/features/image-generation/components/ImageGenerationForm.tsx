import type { ChangeEvent } from "react";
import type { ImageGenerationArtifactOption, ImageGenerationFormValues, ImageGenerationModelLoadStatus, ImageGenerationModelOption } from "../hooks/useImageGenerationFeature";
import { TermWithHint } from "../../../../../../../modules/ui/shared";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";

export function ImageGenerationForm({ form, setForm, validationError, isStartDisabled, onSubmit, availableModels, availableImageArtifacts = [], artifactLoadMessage, modelLoadStatus, modelLoadMessage }: { form: ImageGenerationFormValues; setForm: (v: ImageGenerationFormValues) => void; validationError?: string; isStartDisabled: boolean; onSubmit: () => void; availableModels: ImageGenerationModelOption[]; availableImageArtifacts?: ImageGenerationArtifactOption[]; artifactLoadMessage?: string; modelLoadStatus: ImageGenerationModelLoadStatus; modelLoadMessage?: string; }) {
  const bindText = (key: keyof ImageGenerationFormValues) => ({ value: form[key] as string, onChange: (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }) });
  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <h2>Generate Image</h2>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="prompt">Prompt</TermWithHint></span><input className="ui-input" data-testid="image-prompt" {...bindText("prompt")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="negativePrompt">Negative Prompt</TermWithHint></span><input className="ui-input" {...bindText("negativePrompt")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="seed">Seed</TermWithHint></span><input className="ui-input" {...bindText("seed")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="width">Width</TermWithHint></span><input className="ui-input" type="number" {...bindText("width")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="height">Height</TermWithHint></span><input className="ui-input" type="number" {...bindText("height")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="steps">Steps</TermWithHint></span><input className="ui-input" type="number" {...bindText("steps")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="cfg">CFG</TermWithHint></span><input className="ui-input" type="number" {...bindText("cfg")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="denoise">Denoise</TermWithHint></span><input className="ui-input" type="number" min="0" max="1" step="0.01" {...bindText("denoise")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="sampler">Sampler</TermWithHint></span><input className="ui-input" {...bindText("sampler")} /></label>
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="scheduler">Scheduler</TermWithHint></span><input className="ui-input" {...bindText("scheduler")} /></label>
      <label className="ui-stack ui-stack--sm">
        <span><TermWithHint termId="model">Model/Checkpoint</TermWithHint></span>
        <select className="ui-input" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} disabled={modelLoadStatus === "loading"}>
          <option value="">{modelLoadStatus === "loading" ? "Loading downloaded models..." : "Select a downloaded model"}</option>
          {availableModels.map((model) => <option key={model.modelRecordId} value={model.value}>{model.label}</option>)}
        </select>
      </label>
      {modelLoadMessage ? <p role={modelLoadStatus === "error" ? "alert" : "status"} className={modelLoadStatus === "error" ? "ui-feedback ui-feedback--error" : undefined}>{modelLoadStatus === "loading" ? <LoadingSpinner label="Loading model inventory" /> : null} {modelLoadMessage}</p> : null}
      <label className="ui-stack ui-stack--sm">
        <span><TermWithHint termId="latentSourceArtifact">Latent Source</TermWithHint></span>
        <select className="ui-input" value={form.latentSourceArtifactId} onChange={(event) => setForm({ ...form, latentSourceArtifactId: event.target.value })}>
          <option value="">Empty latent image</option>
          {availableImageArtifacts.map((artifact) => <option key={artifact.value} value={artifact.value}>{artifact.label}</option>)}
        </select>
      </label>
      {artifactLoadMessage ? <p role="alert" className="ui-feedback ui-feedback--error">{artifactLoadMessage}</p> : null}
      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceId">Enable FaceID</TermWithHint> (optional)</span><input type="checkbox" checked={form.faceIdEnabled} onChange={(event) => setForm({ ...form, faceIdEnabled: event.target.checked })} /></label>
      {form.faceIdEnabled ? <div className="ui-stack ui-stack--sm">
        <p>FaceID requires ComfyUI InstantID custom node and models. The runtime will attempt setup; if unavailable, install ComfyUI_InstantID and required models under ComfyUI/models/instantid and ComfyUI/models/insightface/models/antelopev2.</p>
        <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceReferenceImage">Face reference image 1</TermWithHint></span><select className="ui-input" value={form.faceIdArtifactId1} onChange={(event) => setForm({ ...form, faceIdArtifactId1: event.target.value })}><option value="">Select image artifact</option>{availableImageArtifacts.map((artifact) => <option key={artifact.value} value={artifact.value}>{artifact.label}</option>)}</select></label>
        <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceReferenceImage">Face reference image 2</TermWithHint> (optional)</span><select className="ui-input" value={form.faceIdArtifactId2} onChange={(event) => setForm({ ...form, faceIdArtifactId2: event.target.value })}><option value="">Select image artifact</option>{availableImageArtifacts.map((artifact) => <option key={artifact.value} value={artifact.value}>{artifact.label}</option>)}</select></label>
        <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceReferenceImage">Face reference image 3</TermWithHint> (optional)</span><select className="ui-input" value={form.faceIdArtifactId3} onChange={(event) => setForm({ ...form, faceIdArtifactId3: event.target.value })}><option value="">Select image artifact</option>{availableImageArtifacts.map((artifact) => <option key={artifact.value} value={artifact.value}>{artifact.label}</option>)}</select></label>
        <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceIdentityWeight">Face identity weight</TermWithHint></span><input className="ui-input" type="number" step="0.01" {...bindText("faceIdIdentityStrength")} /></label>
        <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceStructureWeight">Face structure weight</TermWithHint></span><input className="ui-input" type="number" step="0.01" {...bindText("faceIdStructureStrength")} /></label>
        <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="faceNoise">Face noise</TermWithHint></span><input className="ui-input" type="number" step="0.01" {...bindText("faceIdNoise")} /></label>
      </div> : null}

      <label className="ui-stack ui-stack--sm"><span><TermWithHint termId="numberOfImages">Number of Images</TermWithHint></span><input className="ui-input" type="number" {...bindText("numImages")} /></label>
      {validationError ? <p className="ui-feedback ui-feedback--error">{validationError}</p> : null}
      <button type="button" className="ui-button" onClick={onSubmit} disabled={isStartDisabled}>{isStartDisabled ? <><LoadingSpinner label="Generating image" /> Generating...</> : "Start Generation"}</button>
    </section>
  );
}
