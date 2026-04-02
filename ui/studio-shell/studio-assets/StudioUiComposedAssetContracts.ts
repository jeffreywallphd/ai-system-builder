import {
  StudioAssetPropertyFieldKinds,
  StudioUiAssetContractVersion,
  StudioUiAssetKinds,
  type ComposedStudioAssetContract,
} from "./StudioAssetContracts";
import { defaultPanelSlotId } from "../experience-assets/PanelAssetContracts";

export const StudioUiComposedKinds = Object.freeze({
  panel: "panel",
});

export type StudioUiComposedKind = typeof StudioUiComposedKinds[keyof typeof StudioUiComposedKinds];

export function createComposedStudioUiContract(input: {
  readonly composedKind: StudioUiComposedKind;
  readonly title: string;
  readonly summary: string;
  readonly documentType?: string;
}): ComposedStudioAssetContract<Record<string, unknown>> {
  const id = `ui-composed:${input.composedKind}`;
  const documentType = input.documentType ?? `ui-composed:${input.composedKind}:json`;

  return Object.freeze({
    contractVersion: StudioUiAssetContractVersion,
    identity: Object.freeze({
      studioType: id,
      studioId: id,
      title: input.title,
      summary: input.summary,
    }),
    kind: StudioUiAssetKinds.composed,
    metadata: Object.freeze({
      displayName: input.title,
      description: input.summary,
      group: "ui-composed-assets",
      iconToken: `composed.${input.composedKind}`,
      tags: Object.freeze(["ui-composed", input.composedKind, "composed-ui"]),
      keywords: Object.freeze([input.composedKind, "container", "layout", "slot"]),
      contractCategory: "composed-ui",
      capabilityFlags: Object.freeze(["composed", "slot-driven"]),
    }),
    propsSchema: Object.freeze({
      schemaId: `studio.ui-composed.${input.composedKind}.props`,
      schemaVersion: "1.0.0",
      propertySchema: Object.freeze({
        schemaId: `studio.ui-composed.${input.composedKind}.properties`,
        schemaVersion: "1.0.0",
        sections: Object.freeze([
          Object.freeze({
            id: "display",
            label: "Display",
            fields: Object.freeze([
              Object.freeze({
                id: "title",
                path: "title",
                label: "Title",
                kind: StudioAssetPropertyFieldKinds.text,
                defaultValue: "Panel",
              }),
              Object.freeze({
                id: "description",
                path: "description",
                label: "Description",
                kind: StudioAssetPropertyFieldKinds.textarea,
                defaultValue: "",
              }),
            ]),
          }),
        ]),
      }),
    }),
    supportedModes: Object.freeze(["full", "embedded", "inline", "readonly"]),
    accepts: Object.freeze({ context: "ui-host", document: documentType, input: Object.freeze({}) }),
    emits: Object.freeze(["ui.change", "ui.action"]),
    hostCapabilities: Object.freeze({
      canNavigate: false,
      canShowShellChrome: false,
      canMutateDraft: true,
      canLaunchRuns: false,
      canManageSessionState: false,
    }),
    rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
    persistence: Object.freeze({ documentType, serialization: "json" }),
    childSlots: Object.freeze([
      Object.freeze({
        slotId: defaultPanelSlotId,
        label: "Panel content",
        required: false,
        allowsMultiple: true,
        allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
        allowedRegistrationCategories: Object.freeze(["atomic-ui", "composed-ui"] as const),
      }),
    ]),
    compositionRules: Object.freeze({
      allowsNestedStudios: false,
      allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
    }),
  });
}

export const defaultComposedStudioUiContracts = Object.freeze([
  createComposedStudioUiContract({
    composedKind: StudioUiComposedKinds.panel,
    title: "Panel",
    summary: "Reusable composed panel asset with slot-based child content.",
  }),
]);
