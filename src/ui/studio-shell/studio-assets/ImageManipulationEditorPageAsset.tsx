import {
  StudioAssetRenderModes,
  StudioUiAssetContractVersion,
  StudioUiAssetKinds,
  type StudioAssetDefinition,
} from "./StudioAssetContracts";
import type { StudioEmbeddedEvent } from "./StudioEmbeddedEventContracts";
import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import { ImageManipulationSystemTemplate } from "@application/system-studio/ImageManipulationSystemTemplate";
import ImageManipulationRuntimeEditorPanel from "../../components/studio-shell/ImageManipulationRuntimeEditorPanel";

export interface ImageManipulationEditorPageInput {
  readonly extensionContext: StudioShellExtensionContext;
}

export const imageManipulationEditorPageAssetDefinition: StudioAssetDefinition<ImageManipulationEditorPageInput, StudioEmbeddedEvent> = Object.freeze({
  contract: Object.freeze({
    contractVersion: StudioUiAssetContractVersion,
    identity: Object.freeze({
      studioType: ImageManipulationSystemTemplate.compositionBindings.pageBindingId,
      studioId: ImageManipulationSystemTemplate.compositionBindings.pageBindingId,
      title: "Image editor page",
      summary: "Runtime image editor page for source upload, settings, preview, and gallery review.",
    }),
    kind: StudioUiAssetKinds.atomic,
    metadata: Object.freeze({
      displayName: "Image Editor Page",
      description: "Runtime editing page for non-technical image manipulation workflows.",
      group: "runtime-pages",
      contractCategory: "atomic-ui",
      capabilityFlags: Object.freeze(["runtime", "image-editor"]),
    }),
    propsSchema: Object.freeze({
      schemaId: "runtime.image-manipulation-editor.input",
      schemaVersion: "1.0.0",
    }),
    supportedModes: Object.freeze([
      StudioAssetRenderModes.full,
      StudioAssetRenderModes.embedded,
      StudioAssetRenderModes.inline,
      StudioAssetRenderModes.readonly,
    ]),
    accepts: Object.freeze({
      context: "studio-host",
      document: "system-draft-json",
      input: Object.freeze({}) as ImageManipulationEditorPageInput,
    }),
    emits: Object.freeze(["studio.intent", "studio.runtime"]),
    hostCapabilities: Object.freeze({
      canNavigate: false,
      canShowShellChrome: false,
      canMutateDraft: true,
      canLaunchRuns: true,
      canManageSessionState: false,
    }),
    rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
    persistence: Object.freeze({ documentType: "system-draft-json", serialization: "json" }),
    capabilities: Object.freeze({ interactive: true, viewer: true }),
    constraints: Object.freeze({ allowsChildren: false }),
  }),
  render: ({ context }) => (
    <ImageManipulationRuntimeEditorPanel context={context.input.extensionContext} />
  ),
});

export default imageManipulationEditorPageAssetDefinition;

