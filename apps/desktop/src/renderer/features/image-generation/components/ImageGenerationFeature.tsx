import { ImageGenerationForm } from "./ImageGenerationForm";
import { ImageGenerationResults } from "./ImageGenerationResults";
import { ImageGenerationStatus } from "./ImageGenerationStatus";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";
import { SettingsPanel } from "../../settings/components";

export function ImageGenerationFeature(props: { workspaceId?: string; workspaceName?: string } = {}) {
  const feature = useImageGenerationFeature(undefined, undefined, undefined, props.workspaceId);
  const previewWidth = Number(feature.form.width);
  const previewHeight = Number(feature.form.height);
  const hasPreviewDimensions = Number.isFinite(previewWidth) && previewWidth > 0 && Number.isFinite(previewHeight) && previewHeight > 0;

  return (
    <div className="ui-stack ui-stack--sm">
      <section className="ui-panel ui-stack ui-stack--sm" aria-label="Runtime readiness">
        <h2 className="ui-panel__title">Runtime readiness</h2>
        <p>ComfyUI status: {feature.installStatus}</p>
        <p>ComfyUI status is not checked until you refresh or run an explicit runtime action.</p>
        <button type="button" className="ui-button" onClick={() => { void feature.refreshInstallStatus(); }}>
          Refresh Runtime Status
        </button>
      </section>
      <SettingsPanel
        compact
        title="Image Generation Runtime Settings"
        description="Select the GPU type used to resolve ComfyUI runtime device mode when auto-detection is unavailable."
        keys={["runtime.imageGeneration.gpuType"]}
      />
      <button type="button" className="ui-button" onClick={() => { void feature.repairInstall(); }}>
        Repair ComfyUI Install
      </button>
      <ImageGenerationForm
        form={feature.form}
        setForm={feature.setForm}
        validationError={feature.validationError}
        isStartDisabled={feature.isStartDisabled}
        onSubmit={() => { void feature.start(); }}
        availableModels={feature.availableModels}
        availableImageArtifacts={feature.availableImageArtifacts}
        artifactLoadMessage={feature.artifactLoadMessage}
        modelLoadStatus={feature.modelLoadStatus}
        modelLoadMessage={feature.modelLoadMessage}
      />
      <ImageGenerationStatus
        status={feature.status}
        requestId={feature.requestId}
        message={feature.message}
        progress={feature.progress}
        error={feature.error}
      />
      {feature.status === "queued" || feature.status === "running" ? (
        <button type="button" className="ui-button" onClick={() => { void feature.cancel(); }}>Cancel</button>
      ) : null}
      <ImageGenerationResults
        outputs={feature.outputs}
        finalizedAssets={feature.finalizedAssets}
        status={feature.status}
        error={feature.error}
        previewWidth={hasPreviewDimensions ? previewWidth : undefined}
        previewHeight={hasPreviewDimensions ? previewHeight : undefined}
      />
    </div>
  );
}
