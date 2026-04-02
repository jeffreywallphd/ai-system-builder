import type { SystemAsset } from "../../../domain/system-studio/SystemAssetDomain";

export interface SystemStudioDraftDocument {
  readonly systemSpec: {
    readonly components: NonNullable<SystemAsset["components"]>;
    readonly nestedSystems: NonNullable<SystemAsset["nestedSystems"]>;
    readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
    readonly bindings: NonNullable<SystemAsset["bindings"]>;
    readonly inputs: NonNullable<SystemAsset["inputs"]>;
    readonly outputs: NonNullable<SystemAsset["outputs"]>;
    readonly parameters: NonNullable<SystemAsset["parameters"]>;
  };
}

const emptyDocument: SystemStudioDraftDocument = Object.freeze({
  systemSpec: Object.freeze({
    components: Object.freeze([]),
    nestedSystems: Object.freeze([]),
    dependencies: Object.freeze([]),
    bindings: Object.freeze([]),
    inputs: Object.freeze([]),
    outputs: Object.freeze([]),
    parameters: Object.freeze([]),
  }),
});

export function parseSystemStudioDraftDocument(content: string): SystemStudioDraftDocument {
  if (!content.trim()) {
    return emptyDocument;
  }

  try {
    const parsed = JSON.parse(content) as { readonly systemSpec?: Partial<SystemStudioDraftDocument["systemSpec"]> };
    return Object.freeze({
      systemSpec: Object.freeze({
        components: Object.freeze(parsed.systemSpec?.components ?? []),
        nestedSystems: Object.freeze(parsed.systemSpec?.nestedSystems ?? []),
        dependencies: Object.freeze(parsed.systemSpec?.dependencies ?? []),
        bindings: Object.freeze(parsed.systemSpec?.bindings ?? []),
        inputs: Object.freeze(parsed.systemSpec?.inputs ?? []),
        outputs: Object.freeze(parsed.systemSpec?.outputs ?? []),
        parameters: Object.freeze(parsed.systemSpec?.parameters ?? []),
      }),
    });
  } catch {
    return emptyDocument;
  }
}
