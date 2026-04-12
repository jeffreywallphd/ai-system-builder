import {
  StudioAssetPropertyFieldKinds,
  StudioUiAssetContractVersion,
  StudioUiAssetKinds,
  type AtomicStudioAssetContract,
} from "./StudioAssetContracts";

export const StudioUiPrimitiveKinds = Object.freeze({
  textInput: "text-input",
  numberInput: "number-input",
  toggle: "toggle",
  button: "button",
  viewer: "viewer",
});

export type StudioUiPrimitiveKind = typeof StudioUiPrimitiveKinds[keyof typeof StudioUiPrimitiveKinds];

export function createAtomicStudioUiPrimitiveContract(input: {
  readonly primitiveKind: StudioUiPrimitiveKind;
  readonly title: string;
  readonly summary: string;
  readonly documentType?: string;
}): AtomicStudioAssetContract<Record<string, unknown>> {
  const id = `ui-primitive:${input.primitiveKind}`;
  const documentType = input.documentType ?? `ui-primitive:${input.primitiveKind}:json`;
  return Object.freeze({
    contractVersion: StudioUiAssetContractVersion,
    identity: Object.freeze({
      studioType: id,
      studioId: id,
      title: input.title,
      summary: input.summary,
    }),
    kind: StudioUiAssetKinds.atomic,
    metadata: Object.freeze({
      displayName: input.title,
      description: input.summary,
      group: "ui-primitives",
      iconToken: `primitive.${input.primitiveKind}`,
      tags: Object.freeze(["ui-primitive", input.primitiveKind, "atomic-ui"]),
      keywords: Object.freeze([input.primitiveKind, "input", "control"]),
      contractCategory: "atomic-ui",
      capabilityFlags: Object.freeze([
        input.primitiveKind === StudioUiPrimitiveKinds.viewer ? "viewer" : "interactive",
      ]),
    }),
    propsSchema: Object.freeze({
      schemaId: `studio.ui-primitive.${input.primitiveKind}.props`,
      schemaVersion: "1.0.0",
      propertySchema: Object.freeze({
        schemaId: `studio.ui-primitive.${input.primitiveKind}.properties`,
        schemaVersion: "1.0.0",
        sections: Object.freeze([
          Object.freeze({
            id: "display",
            label: "Display",
            description: "Basic presentation settings for this UI primitive.",
            fields: Object.freeze([
              Object.freeze({
                id: "label",
                path: "label",
                label: "Label",
                kind: StudioAssetPropertyFieldKinds.text,
                helpText: "Friendly text shown to people using this control.",
                defaultValue: input.title,
              }),
              Object.freeze({
                id: "helperText",
                path: "helperText",
                label: "Help text",
                kind: StudioAssetPropertyFieldKinds.textarea,
                helpText: "Optional support text shown below the control.",
                defaultValue: "",
              }),
              Object.freeze({
                id: "isVisible",
                path: "isVisible",
                label: "Show this element",
                kind: StudioAssetPropertyFieldKinds.boolean,
                defaultValue: true,
              }),
            ]),
          }),
          Object.freeze({
            id: "behavior",
            label: "Behavior",
            fields: Object.freeze([
              Object.freeze({
                id: "required",
                path: "required",
                label: "Required",
                kind: StudioAssetPropertyFieldKinds.boolean,
                defaultValue: false,
              }),
              Object.freeze({
                id: "readOnly",
                path: "readOnly",
                label: "Read-only",
                kind: StudioAssetPropertyFieldKinds.boolean,
                defaultValue: input.primitiveKind === StudioUiPrimitiveKinds.viewer,
              }),
            ]),
          }),
        ]),
      }),
    }),
    supportedModes: Object.freeze(["full", "embedded", "inline", "readonly"]),
    accepts: Object.freeze({
      context: "ui-host",
      document: documentType,
      input: Object.freeze({}),
    }),
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
    capabilities: Object.freeze({
      interactive: input.primitiveKind !== StudioUiPrimitiveKinds.viewer,
      viewer: input.primitiveKind === StudioUiPrimitiveKinds.viewer,
    }),
    constraints: Object.freeze({
      allowsChildren: false,
    }),
  });
}

export const defaultAtomicStudioUiPrimitiveContracts = Object.freeze([
  createAtomicStudioUiPrimitiveContract({
    primitiveKind: StudioUiPrimitiveKinds.textInput,
    title: "Text Input",
    summary: "Leaf text entry UI primitive.",
  }),
  createAtomicStudioUiPrimitiveContract({
    primitiveKind: StudioUiPrimitiveKinds.numberInput,
    title: "Number Input",
    summary: "Leaf numeric entry UI primitive.",
  }),
  createAtomicStudioUiPrimitiveContract({
    primitiveKind: StudioUiPrimitiveKinds.toggle,
    title: "Toggle",
    summary: "Leaf boolean switch UI primitive.",
  }),
  createAtomicStudioUiPrimitiveContract({
    primitiveKind: StudioUiPrimitiveKinds.button,
    title: "Button",
    summary: "Leaf action-trigger UI primitive.",
  }),
  createAtomicStudioUiPrimitiveContract({
    primitiveKind: StudioUiPrimitiveKinds.viewer,
    title: "Viewer",
    summary: "Leaf read-only presentation UI primitive.",
  }),
]);
