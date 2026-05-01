import { ImageGenerationForm } from "./ImageGenerationForm";
import { ImageGenerationResults } from "./ImageGenerationResults";
import { ImageGenerationStatus } from "./ImageGenerationStatus";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

export function ImageGenerationFeature() {
  const feature = useImageGenerationFeature();
  return <div className="ui-stack ui-stack--sm"><p>ComfyUI status: {feature.installStatus}</p><p>ComfyUI will be installed automatically when generation starts.</p><button type="button" className="ui-button" onClick={() => { void feature.repairInstall(); }}>Repair ComfyUI Install</button><ImageGenerationForm form={feature.form} setForm={feature.setForm} validationError={feature.validationError} isStartDisabled={feature.isStartDisabled} onSubmit={() => { void feature.start(); }} availableModels={feature.availableModels} /><ImageGenerationStatus status={feature.status} requestId={feature.requestId} message={feature.message} progress={feature.progress} error={feature.error} />{feature.status === "queued" || feature.status === "running" ? <button type="button" className="ui-button" onClick={() => { void feature.cancel(); }}>Cancel</button> : null}<ImageGenerationResults outputs={feature.outputs} finalizedAssets={feature.finalizedAssets} /></div>;
}
