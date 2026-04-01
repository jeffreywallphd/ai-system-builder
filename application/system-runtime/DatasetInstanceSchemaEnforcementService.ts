import type { CanonicalDataShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  createMediaValidationResult,
  type IMediaDatasetValidator,
  type IMediaRecordValidator,
  type MediaValidationResult,
} from "../../domain/dataset-studio/interfaces/MediaValidation";
import { DatasetSchemaIntentIds } from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { DatasetInstance } from "../../domain/system-runtime/DatasetInstanceDomain";
import type {
  DatasetInstanceAssetCatalog,
  DatasetInstanceAssetDefinition,
} from "./DatasetInstanceAssetCatalog";

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function summarizeIssues(result: MediaValidationResult<unknown>): string {
  return result.issues.map((issue) => `${issue.code}${issue.path ? `@${issue.path}` : ""}`).join(", ");
}

export class DatasetInstanceSchemaEnforcementService {
  public constructor(
    private readonly assetCatalog: DatasetInstanceAssetCatalog,
    private readonly mediaDatasetValidator: IMediaDatasetValidator,
    private readonly mediaRecordValidator: IMediaRecordValidator,
  ) {}

  public validateShapeForInstance(input: {
    readonly instance: DatasetInstance;
    readonly shape: CanonicalDataShape;
  }): ReturnType<IMediaDatasetValidator["validateShape"]> {
    const asset = this.resolveAssetDefinition(input.instance);
    if (asset.outputShapeKind !== input.shape.kind) {
      throw new Error(
        `invalid-request:Incoming shape '${input.shape.kind}' is incompatible with dataset asset output shape '${asset.outputShapeKind}'.`,
      );
    }

    if (asset.schemaIntentId !== DatasetSchemaIntentIds.media) {
      return createMediaValidationResult([], Object.freeze([]));
    }

    return this.mediaDatasetValidator.validateShape(input.shape);
  }

  public validateRecordForInstance(input: {
    readonly instance: DatasetInstance;
    readonly record: unknown;
  }): MediaValidationResult<unknown> {
    const recordsValidation = this.validateRecordsForInstance({
      instance: input.instance,
      records: Object.freeze([input.record]),
    });
    if (!recordsValidation.value || recordsValidation.value.length === 0) {
      return createMediaValidationResult(recordsValidation.issues);
    }
    return createMediaValidationResult(recordsValidation.issues, recordsValidation.value[0]);
  }

  public validateRecordsForInstance(input: {
    readonly instance: DatasetInstance;
    readonly records: ReadonlyArray<unknown>;
  }): MediaValidationResult<ReadonlyArray<unknown>> {
    const asset = this.resolveAssetDefinition(input.instance);
    if (asset.outputShapeKind !== "records" && asset.outputShapeKind !== "image-metadata-records") {
      throw new Error(
        `invalid-request:Dataset instance '${input.instance.instanceId}' does not support record admission for output shape '${asset.outputShapeKind}'.`,
      );
    }

    if (asset.schemaIntentId !== DatasetSchemaIntentIds.media) {
      return createMediaValidationResult([], Object.freeze([...input.records]));
    }

    const mediaValidation = this.mediaRecordValidator.validateRecords(input.records, "records");
    return createMediaValidationResult(
      mediaValidation.issues,
      mediaValidation.value ? Object.freeze([...mediaValidation.value]) : undefined,
    );
  }

  public admitRecordForInstance(input: {
    readonly instance: DatasetInstance;
    readonly record: unknown;
  }): unknown {
    const validation = this.validateRecordForInstance(input);
    if (!validation.valid) {
      throw new Error(
        `invalid-request:Dataset instance '${input.instance.instanceId}' rejected record admission (${summarizeIssues(validation)}).`,
      );
    }

    if (validation.value === undefined) {
      throw new Error(
        `invalid-request:Dataset instance '${input.instance.instanceId}' could not materialize an admitted record value.`,
      );
    }

    return validation.value;
  }

  public admitRecordsForInstance(input: {
    readonly instance: DatasetInstance;
    readonly records: ReadonlyArray<unknown>;
  }): ReadonlyArray<unknown> {
    const validation = this.validateRecordsForInstance(input);
    if (!validation.valid) {
      throw new Error(
        `invalid-request:Dataset instance '${input.instance.instanceId}' rejected record admission (${summarizeIssues(validation)}).`,
      );
    }
    if (!validation.value) {
      return Object.freeze([]);
    }
    return Object.freeze([...validation.value]);
  }

  private resolveAssetDefinition(instance: DatasetInstance): DatasetInstanceAssetDefinition {
    const asset = this.assetCatalog.resolveAsset({
      assetId: instance.datasetAssetId,
      versionId: instance.datasetAssetVersionId,
    });
    if (!asset) {
      throw new Error(
        `invalid-request:Dataset instance '${instance.instanceId}' references missing dataset asset '${instance.datasetAssetId}@${normalizeOptional(instance.datasetAssetVersionId) ?? "latest"}'.`,
      );
    }
    return asset;
  }
}
