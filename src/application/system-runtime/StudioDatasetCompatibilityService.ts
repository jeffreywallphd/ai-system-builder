import type { DatasetPreviewSelectionSnapshot } from "../data-studio/DatasetPreviewSelectionModel";
import {
  createDatasetAssetReference,
  createDatasetInstanceReference,
  createDatasetRecordReference,
  type DatasetAssetReference,
  type DatasetInstanceReference,
  type DatasetRecordReference,
} from "@domain/dataset-studio/contracts/StudioDatasetCompatibility";
import type { DatasetInstance } from "@domain/system-runtime/DatasetInstanceDomain";
import type { DatasetInstanceImagePreviewList } from "./DatasetInstancePreviewService";
import type { SystemDatasetInstanceService } from "./SystemDatasetInstanceService";

export class StudioDatasetCompatibilityService {
  public toDatasetAssetReference(instance: Pick<DatasetInstance, "datasetAssetId" | "datasetAssetVersionId">): DatasetAssetReference {
    return createDatasetAssetReference({
      assetId: instance.datasetAssetId,
      versionId: instance.datasetAssetVersionId,
    });
  }

  public toDatasetInstanceReference(instance: Pick<DatasetInstance, "systemId" | "instanceId" | "datasetAssetId" | "datasetAssetVersionId">): DatasetInstanceReference {
    return createDatasetInstanceReference({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      dataset: this.toDatasetAssetReference(instance),
    });
  }

  public toRecordReferencesFromPreview(preview: DatasetInstanceImagePreviewList): ReadonlyArray<DatasetRecordReference> {
    const dataset = createDatasetAssetReference({
      assetId: preview.summary.datasetAssetId,
      versionId: preview.summary.datasetAssetVersionId,
    });
    const instance = createDatasetInstanceReference({
      systemId: preview.summary.systemId,
      instanceId: preview.summary.instanceId,
      dataset,
    });
    return Object.freeze(preview.items.map((item) => createDatasetRecordReference({
      dataset,
      selectionId: item.selectionId,
      recordId: item.recordId,
      instance,
      imageReference: item.imageReference,
    })));
  }

  public assertSelectionCompatibility(input: {
    readonly selection: DatasetPreviewSelectionSnapshot;
    readonly datasetAssetId: string;
  }): void {
    const expectedAssetId = input.datasetAssetId.trim();
    if (!expectedAssetId) {
      throw new Error("invalid-request:Dataset asset id is required for selection compatibility checks.");
    }
    if (input.selection.datasetAssetId.trim() !== expectedAssetId) {
      throw new Error(
        `invalid-request:Selection dataset asset '${input.selection.datasetAssetId}' does not match required dataset asset '${expectedAssetId}'.`,
      );
    }
    for (const selected of input.selection.selectedRecords) {
      if (selected.dataset.assetId !== expectedAssetId) {
        throw new Error(
          `invalid-request:Selected record '${selected.recordId}' references dataset asset '${selected.dataset.assetId}', expected '${expectedAssetId}'.`,
        );
      }
    }
  }

  public async resolveSelectionRecords(input: {
    readonly datasetService: Pick<SystemDatasetInstanceService, "getImageRecordsFromInstanceByIds">;
    readonly systemId: string;
    readonly instanceId: string;
    readonly selection: DatasetPreviewSelectionSnapshot;
  }) {
    const recordIds = input.selection.selectedRecords.map((record) => record.recordId);
    return input.datasetService.getImageRecordsFromInstanceByIds({
      systemId: input.systemId,
      instanceId: input.instanceId,
      recordIds,
    });
  }
}

