import { ImageGenerationForm } from "./ImageGenerationForm";
import { ImageGenerationResults } from "./ImageGenerationResults";
import { ImageGenerationStatus } from "./ImageGenerationStatus";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

export function ImageGenerationFeature() {
  const feature = useImageGenerationFeature();
  return <div className="ui-stack ui-stack--sm image-gen"><ImageGenerationForm form={feature.form} setForm={feature.setForm} validationError={feature.validationError} onSubmit={() => { void feature.start(); }} /><ImageGenerationStatus status={feature.status} requestId={feature.requestId} message={feature.message} progress={feature.progress} error={feature.error} />{feature.status === "queued" || feature.status === "running" ? <button type="button" className="ui-button" onClick={() => { void feature.cancel(); }}>Cancel</button> : null}<ImageGenerationResults taskData={feature.taskData} finalized={feature.finalized} /></div>;
}
