import type { DatasetInstanceRepository } from "./DatasetInstanceRepository";
import type {
  SerializedSystemRuntimeDatasetInstancePersistedState,
  SerializedSystemRuntimeDatasetInstanceReference,
} from "../../domain/system-studio/SystemSerializationContract";

export interface CaptureSystemDatasetInstancePersistenceResult {
  readonly datasetInstances: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
}

export interface RestoreSystemDatasetInstancePersistenceIssue {
  readonly code: "missing-dataset-instance-state" | "invalid-dataset-instance-state";
  readonly message: string;
  readonly severity: "warning" | "error";
}

export interface RestoreSystemDatasetInstancePersistenceResult {
  readonly issues: ReadonlyArray<RestoreSystemDatasetInstancePersistenceIssue>;
}

export class SystemDatasetInstancePersistenceService {
  public constructor(private readonly repository: Pick<
    DatasetInstanceRepository,
    "listBySystemId" | "listImageRecordsBySystemId" | "save" | "saveImageRecord"
  >) {}

  public captureSystemDatasetInstances(systemId: string): CaptureSystemDatasetInstancePersistenceResult {
    const datasetInstances = this.repository.listBySystemId(systemId).map((instance) => {
      const records = this.repository.listImageRecordsBySystemId({
        systemId,
        instanceId: instance.instanceId,
      });
      const persistedState: SerializedSystemRuntimeDatasetInstancePersistedState = Object.freeze({
        instance,
        imageRecords: Object.freeze(records),
      });
      return Object.freeze({
        instanceId: instance.instanceId,
        datasetAssetId: instance.datasetAssetId,
        datasetVersionId: instance.datasetAssetVersionId,
        role: instance.role,
        persistedState,
      });
    });

    return Object.freeze({
      datasetInstances: Object.freeze(datasetInstances),
    });
  }

  public restoreSystemDatasetInstances(input: {
    readonly systemId: string;
    readonly datasetInstances: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
  }): RestoreSystemDatasetInstancePersistenceResult {
    const issues: RestoreSystemDatasetInstancePersistenceIssue[] = [];

    for (const entry of input.datasetInstances) {
      if (!entry.persistedState) {
        issues.push(Object.freeze({
          code: "missing-dataset-instance-state",
          message: `Dataset instance '${entry.instanceId}' did not include persisted runtime state.`,
          severity: "warning",
        }));
        continue;
      }

      const { instance, imageRecords } = entry.persistedState;
      if (!instance || instance.instanceId !== entry.instanceId || instance.systemId !== input.systemId) {
        issues.push(Object.freeze({
          code: "invalid-dataset-instance-state",
          message: `Dataset instance '${entry.instanceId}' contains incompatible persisted state identity.`,
          severity: "error",
        }));
        continue;
      }

      this.repository.save(instance);
      for (const record of imageRecords ?? []) {
        if (record.instanceId !== entry.instanceId || record.systemId !== input.systemId) {
          issues.push(Object.freeze({
            code: "invalid-dataset-instance-state",
            message: `Dataset instance '${entry.instanceId}' includes image record '${record.recordId}' with mismatched ownership.`,
            severity: "error",
          }));
          continue;
        }
        this.repository.saveImageRecord(record);
      }
    }

    return Object.freeze({ issues: Object.freeze(issues) });
  }
}
