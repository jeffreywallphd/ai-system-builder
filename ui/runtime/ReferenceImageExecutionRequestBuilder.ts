import { ReferenceImageSystemTemplate } from "../../application/system-studio/ReferenceImageSystemTemplate";
import { createDefaultUiTriggerSystemContextMapper } from "../../application/workflow-studio/UiTriggerSystemContextMapper";
import { createDefaultWorkflowSystemContextBindingAdapter } from "../../application/workflow-studio/SystemContextWorkflowInputMapper";
import { createUiTriggerEvent } from "../../application/workflow-studio/UiTriggerEventContract";
import type { SystemContextContract } from "../../src/domain/system-studio/SystemContextContract";

export function buildReferenceImageStartRequest(input: {
  readonly studioId: string;
  readonly draftId: string;
  readonly systemAssetId: string;
  readonly runtimeContext: SystemContextContract;
}) {
  const mapper = createDefaultUiTriggerSystemContextMapper();
  const bindingAdapter = createDefaultWorkflowSystemContextBindingAdapter({
    mappingConfiguration: ReferenceImageSystemTemplate.primaryWorkflowAsset.contextMapping,
  });
  const event = createUiTriggerEvent({
    kind: "submit",
    name: "ui.reference-image.start",
    source: {
      studio: "system-studio",
      componentId: "reference-image-experience",
      actionId: "start",
    },
    payload: {
      imageId: input.runtimeContext.selectedImages[0]?.assetRef?.assetId,
      selectedImage: {
        imageId: input.runtimeContext.selectedImages[0]?.imageId,
        assetRef: {
          assetId: input.runtimeContext.selectedImages[0]?.assetRef?.assetId,
          recordId: input.runtimeContext.selectedImages[0]?.assetRef?.recordId,
        },
      },
      parameters: input.runtimeContext.parameters,
    },
    context: {
      systemAssetId: input.systemAssetId,
      references: {
        systemDatasetInstanceId: input.runtimeContext.datasets[0]?.instanceId,
        datasetInstanceId: input.runtimeContext.datasets[0]?.instanceId,
        systemDatasetRole: "input-store",
      },
    },
  });
  const systemContext = mapper.map(event);
  const mapped = bindingAdapter.map(systemContext);
  return Object.freeze({
    studioId: input.studioId,
    draftId: input.draftId,
    context: Object.freeze({
      trigger: "manual" as const,
      actorId: "reference-image-ui",
      inputValues: mapped.inputValues,
      metadata: mapped.metadata,
      runtimeContext: systemContext,
    }),
  });
}
