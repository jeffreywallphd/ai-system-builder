import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  createCompositionTaxonomyDescriptor,
  type CompositionTaxonomyDescriptor,
} from "../../domain/taxonomy/CompositionTaxonomy";
import { createBatchTransformWorkflowAsset, type BatchTransformWorkflowAsset } from "./BatchTransformWorkflowAsset";
import { createEnhanceUpscaleWorkflowAsset, type EnhanceUpscaleWorkflowAsset } from "./EnhanceUpscaleWorkflowAsset";
import { createImageToImageWorkflowAsset, type ImageToImageWorkflowAsset } from "./ImageToImageWorkflowAsset";
import type { ImageWorkflowAssetContract } from "./ImageWorkflowAssetContract";
import { ImageWorkflowAssetIntentTypes } from "./ImageWorkflowAssetContract";
import type { ImageWorkflowAssetPreview } from "./ImageWorkflowAssetPreview";
import { serializeImageWorkflowInputBindingConfiguration } from "./ImageWorkflowInputBindingConfiguration";
import { createRestyleWorkflowAsset, type RestyleWorkflowAsset } from "./RestyleWorkflowAsset";

export type ImageWorkflowAssetDefinition =
  | ImageToImageWorkflowAsset
  | RestyleWorkflowAsset
  | EnhanceUpscaleWorkflowAsset
  | BatchTransformWorkflowAsset;

const imageWorkflowTaxonomy = createCompositionTaxonomyDescriptor({
  structuralKind: TaxonomyStructuralKinds.composite,
  semanticRole: TaxonomySemanticRoles.workflow,
  behaviorKind: TaxonomyBehaviorKinds.deterministic,
});

export interface ImageWorkflowAssetRegistryEntry {
  readonly id: string;
  readonly version: string;
  readonly intentType: string;
  readonly title: string;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract: Pick<ImageWorkflowAssetContract, "identity" | "input" | "output" | "config" | "preview">;
  readonly preview: ImageWorkflowAssetPreview;
  readonly configurationSurface: ReadonlyArray<{
    readonly id: string;
    readonly valueType: string;
    readonly required: boolean;
    readonly defaultValue?: unknown;
    readonly description?: string;
  }>;
  readonly inputBindings: Readonly<Record<string, unknown>>;
}

export class ImageWorkflowAssetRegistry {
  private readonly entries: ReadonlyArray<ImageWorkflowAssetDefinition>;

  public constructor(entries: ReadonlyArray<ImageWorkflowAssetDefinition> = [
    createImageToImageWorkflowAsset(),
    createRestyleWorkflowAsset(),
    createEnhanceUpscaleWorkflowAsset(),
    createBatchTransformWorkflowAsset(),
  ]) {
    this.entries = Object.freeze(entries.map((entry) => Object.freeze(entry)));
  }

  public listDefinitions(): ReadonlyArray<ImageWorkflowAssetDefinition> {
    return this.entries;
  }

  public list(): ReadonlyArray<ImageWorkflowAssetRegistryEntry> {
    return Object.freeze(this.entries.map((entry) => Object.freeze({
      id: entry.id,
      version: entry.version,
      intentType: entry.intentType,
      title: entry.preview.title,
      summary: entry.preview.summary,
      tags: Object.freeze([...(entry.composition.tags ?? [])]),
      taxonomy: imageWorkflowTaxonomy,
      contract: Object.freeze({
        identity: entry.contract.identity,
        input: entry.contract.input,
        output: entry.contract.output,
        config: entry.contract.config,
        preview: entry.contract.preview,
      }),
      preview: entry.preview,
      configurationSurface: Object.freeze(entry.contract.config.fields.map((field) => Object.freeze({
        id: field.id,
        valueType: field.valueType,
        required: field.required,
        defaultValue: field.defaultValue,
        description: field.description,
      }))),
      inputBindings: serializeImageWorkflowInputBindingConfiguration(entry.inputBindings),
    })));
  }

  public getByIntent(intentType: string): ImageWorkflowAssetDefinition | undefined {
    return this.entries.find((entry) => entry.intentType === intentType);
  }

  public getById(assetId: string): ImageWorkflowAssetDefinition | undefined {
    const normalized = assetId.trim();
    return this.entries.find((entry) => entry.id === normalized);
  }

  public listByIntentTypes(intentTypes: ReadonlyArray<string>): ReadonlyArray<ImageWorkflowAssetRegistryEntry> {
    const requested = new Set(intentTypes.map((entry) => entry.trim()).filter(Boolean));
    if (requested.size === 0) {
      return this.list();
    }
    return Object.freeze(this.list().filter((entry) => requested.has(entry.intentType)));
  }
}

export function createDefaultImageWorkflowAssetRegistry(): ImageWorkflowAssetRegistry {
  return new ImageWorkflowAssetRegistry();
}

export function listCoreImageWorkflowIntentTypes(): ReadonlyArray<string> {
  return Object.freeze([
    ImageWorkflowAssetIntentTypes.imageToImage,
    ImageWorkflowAssetIntentTypes.restyle,
    ImageWorkflowAssetIntentTypes.enhanceUpscale,
    ImageWorkflowAssetIntentTypes.batchTransform,
  ]);
}
