import type { StudioAssetRegistration } from "./StudioAssetRegistry";
import { StudioUiAssetKinds } from "./StudioAssetContracts";
import { applyStudioAssetPropertySchemaDefaults } from "./StudioAssetPropertySchema";

export const StudioAssetPreviewKinds = Object.freeze({
  atomicControl: "atomic-control",
  summary: "summary",
  unsupported: "unsupported",
});

export type StudioAssetPreviewKind = typeof StudioAssetPreviewKinds[keyof typeof StudioAssetPreviewKinds];

export interface StudioAssetPreviewModel {
  readonly kind: StudioAssetPreviewKind;
  readonly title: string;
  readonly description?: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly reason?: string;
}

function resolveAtomicPreviewKind(registration: StudioAssetRegistration): StudioAssetPreviewKind {
  if (registration.kind !== StudioUiAssetKinds.atomic) {
    return StudioAssetPreviewKinds.summary;
  }
  if (registration.contract.previewHooks?.canRenderPreview === false) {
    return StudioAssetPreviewKinds.unsupported;
  }
  return StudioAssetPreviewKinds.atomicControl;
}

export function createStudioAssetPreviewModel(input: {
  readonly registration: StudioAssetRegistration;
  readonly config?: Readonly<Record<string, unknown>>;
}): StudioAssetPreviewModel {
  const propertySchema = input.registration.contract.propsSchema.propertySchema;
  const baseConfig = Object.freeze({ ...(input.config ?? {}) });
  const resolvedConfig = propertySchema
    ? applyStudioAssetPropertySchemaDefaults({ schema: propertySchema, config: baseConfig })
    : baseConfig;

  const kind = resolveAtomicPreviewKind(input.registration);
  return Object.freeze({
    kind,
    title: input.registration.metadata.title,
    description: input.registration.metadata.summary,
    config: resolvedConfig,
    reason: kind === StudioAssetPreviewKinds.unsupported ? "Preview is not available for this asset yet." : undefined,
  });
}
