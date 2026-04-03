import type { CanonicalDataShape, CanonicalDataShapeKind } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  createSchemaIntentValidationResult,
  DatasetSchemaIntentIds,
  DatasetSchemaIntentValidationSeverities,
  type DatasetSchemaIntentId,
  type DatasetSchemaIntentDescriptor,
  type IDatasetSchemaIntent,
  type IDatasetSchemaIntentRegistry,
} from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { MediaSchemaIntentAdapter } from "./adapters/schema-intents/MediaSchemaIntentAdapter";

class PassThroughSchemaIntent implements IDatasetSchemaIntent {
  public readonly descriptor: DatasetSchemaIntentDescriptor;

  constructor(descriptor: DatasetSchemaIntentDescriptor) {
    this.descriptor = Object.freeze({
      ...descriptor,
      supportedShapeKinds: Object.freeze([...descriptor.supportedShapeKinds]),
      metadata: descriptor.metadata ? Object.freeze({ ...descriptor.metadata }) : undefined,
    });
  }

  public validateShape(shape: CanonicalDataShape) {
    if (!this.descriptor.supportedShapeKinds.includes(shape.kind)) {
      return createSchemaIntentValidationResult([
        Object.freeze({
          code: "schema-intent.unsupported-shape-kind",
          message: `Schema intent '${this.descriptor.id}' does not support shape kind '${shape.kind}'.`,
          severity: DatasetSchemaIntentValidationSeverities.error,
          path: "shape.kind",
        }),
      ]);
    }

    return createSchemaIntentValidationResult([]);
  }
}

function normalizeIntentId(intentId: string): DatasetSchemaIntentId {
  const normalized = intentId.trim() as DatasetSchemaIntentId;
  if (!normalized) {
    throw new Error("Dataset schema intent id cannot be empty.");
  }
  if (!Object.values(DatasetSchemaIntentIds).includes(normalized)) {
    throw new Error(`Dataset schema intent id '${intentId}' is not supported.`);
  }
  return normalized;
}

export class DatasetSchemaIntentRegistry implements IDatasetSchemaIntentRegistry {
  private readonly intentsById = new Map<string, IDatasetSchemaIntent>();
  private readonly intentOrder: string[] = [];

  public register(intent: IDatasetSchemaIntent): void {
    const intentId = normalizeIntentId(intent.descriptor.id);
    if (this.intentsById.has(intentId)) {
      throw new Error(`Dataset schema intent '${intentId}' is already registered.`);
    }

    this.intentsById.set(intentId, intent);
    this.intentOrder.push(intentId);
  }

  public get(intentId: DatasetSchemaIntentId): IDatasetSchemaIntent | undefined {
    return this.intentsById.get(normalizeIntentId(intentId));
  }

  public list(): ReadonlyArray<DatasetSchemaIntentDescriptor> {
    return Object.freeze(this.intentOrder
      .map((intentId) => this.intentsById.get(intentId)?.descriptor)
      .filter((descriptor): descriptor is DatasetSchemaIntentDescriptor => Boolean(descriptor))
      .map((descriptor) => Object.freeze({
        ...descriptor,
        supportedShapeKinds: Object.freeze([...descriptor.supportedShapeKinds]),
        metadata: descriptor.metadata ? Object.freeze({ ...descriptor.metadata }) : undefined,
      })));
  }

  public resolveForShapeKind(shapeKind: CanonicalDataShapeKind): IDatasetSchemaIntent | undefined {
    return this.intentOrder
      .map((intentId) => this.intentsById.get(intentId))
      .find((intent) => intent?.descriptor.supportedShapeKinds.includes(shapeKind));
  }
}

export function createDefaultDatasetSchemaIntentRegistry(): DatasetSchemaIntentRegistry {
  const registry = new DatasetSchemaIntentRegistry();

  registry.register(new PassThroughSchemaIntent({
    id: DatasetSchemaIntentIds.tabular,
    name: "Tabular",
    description: "Structured tabular and record-oriented datasets.",
    contractVersion: "1.0.0",
    supportedShapeKinds: Object.freeze(["records", "table"] as const),
    metadata: Object.freeze({
      inspectabilityHint: "rows-columns",
    }),
  }));

  registry.register(new PassThroughSchemaIntent({
    id: DatasetSchemaIntentIds.document,
    name: "Document",
    description: "Text-item and extracted document datasets.",
    contractVersion: "1.0.0",
    supportedShapeKinds: Object.freeze(["text-items"] as const),
    metadata: Object.freeze({
      inspectabilityHint: "chunks-and-text",
    }),
  }));

  registry.register(new PassThroughSchemaIntent({
    id: DatasetSchemaIntentIds.semantic,
    name: "Semantic",
    description: "Semantically-enriched datasets with embedding-oriented payloads.",
    contractVersion: "1.0.0",
    supportedShapeKinds: Object.freeze(["records", "text-items"] as const),
    metadata: Object.freeze({
      inspectabilityHint: "semantic-features",
    }),
  }));

  registry.register(new MediaSchemaIntentAdapter());
  return registry;
}
