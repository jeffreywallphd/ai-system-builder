import { StudioUiAssetKinds, type AtomicStudioAssetContract } from "./StudioAssetContracts";

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
      tags: Object.freeze(["ui-primitive", input.primitiveKind, "atomic-ui"]),
    }),
    propsSchema: Object.freeze({
      schemaId: `studio.ui-primitive.${input.primitiveKind}.props`,
      schemaVersion: "1.0.0",
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
