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

export const DatasetInstanceDuplicationModes = Object.freeze({
  reuse: "reuse",
  duplicate: "duplicate",
});

export type DatasetInstanceDuplicationMode =
  typeof DatasetInstanceDuplicationModes[keyof typeof DatasetInstanceDuplicationModes];

export interface DuplicateSystemDatasetInstancePersistenceRequest {
  readonly sourceSystemId: string;
  readonly targetSystemId: string;
  readonly datasetInstances: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
  readonly mode: DatasetInstanceDuplicationMode;
}

export interface DuplicateSystemDatasetInstancePersistenceResult {
  readonly datasetInstances: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
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
          message: `Saved data for '${entry.instanceId}' is incomplete. We restored the last complete data we could use.`,
          severity: "warning",
        }));
        continue;
      }

      const { instance, imageRecords } = entry.persistedState;
      if (!instance || instance.instanceId !== entry.instanceId || instance.systemId !== input.systemId) {
        issues.push(Object.freeze({
          code: "invalid-dataset-instance-state",
          message: `Saved data for '${entry.instanceId}' does not match this system. This part was skipped during restore.`,
          severity: "error",
        }));
        continue;
      }

      const normalizedRecords = imageRecords ?? [];
      const invalidRecord = normalizedRecords.find((record) => (
        record.instanceId !== entry.instanceId || record.systemId !== input.systemId
      ));
      if (invalidRecord) {
        issues.push(Object.freeze({
          code: "invalid-dataset-instance-state",
          message: `Saved results for '${entry.instanceId}' were incomplete or mixed with another source. We skipped restoring those results.`,
          severity: "error",
        }));
        continue;
      }

      try {
        this.repository.save(instance);
        for (const record of normalizedRecords) {
          this.repository.saveImageRecord(record);
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : "unknown error";
        issues.push(Object.freeze({
          code: "invalid-dataset-instance-state",
          message: `Couldn't fully restore saved data for '${entry.instanceId}'. Some recent results may need to be checked. (${details})`,
          severity: "error",
        }));
        continue;
      }

    }

    return Object.freeze({ issues: Object.freeze(issues) });
  }

  public duplicateSystemDatasetInstances(
    input: DuplicateSystemDatasetInstancePersistenceRequest,
  ): DuplicateSystemDatasetInstancePersistenceResult {
    if (input.mode === DatasetInstanceDuplicationModes.reuse) {
      return Object.freeze({
        datasetInstances: Object.freeze([...input.datasetInstances]),
        issues: Object.freeze([]),
      });
    }

    const issues: RestoreSystemDatasetInstancePersistenceIssue[] = [];
    const datasetInstances = input.datasetInstances.map((entry) => {
      const duplicatedInstanceId = `${input.targetSystemId}::${entry.instanceId}`;
      const persistedState = entry.persistedState;
      if (!persistedState?.instance) {
        issues.push(Object.freeze({
          code: "missing-dataset-instance-state",
          message: `Dataset instance '${entry.instanceId}' did not include persisted runtime state for duplication.`,
          severity: "warning",
        }));
        return Object.freeze({
          ...entry,
          instanceId: duplicatedInstanceId,
          persistedState: undefined,
        });
      }

      if (
        persistedState.instance.instanceId !== entry.instanceId
        || persistedState.instance.systemId !== input.sourceSystemId
      ) {
        issues.push(Object.freeze({
          code: "invalid-dataset-instance-state",
          message: `Dataset instance '${entry.instanceId}' contains incompatible persisted state identity for duplication.`,
          severity: "error",
        }));
        return Object.freeze({
          ...entry,
          instanceId: duplicatedInstanceId,
          persistedState: undefined,
        });
      }

      return Object.freeze({
        ...entry,
        instanceId: duplicatedInstanceId,
        persistedState: Object.freeze({
          instance: Object.freeze({
            ...persistedState.instance,
            instanceId: duplicatedInstanceId,
            systemId: input.targetSystemId,
          }),
          imageRecords: Object.freeze((persistedState.imageRecords ?? []).map((record) => Object.freeze({
            ...record,
            instanceId: duplicatedInstanceId,
            systemId: input.targetSystemId,
          }))),
        }),
      });
    });

    return Object.freeze({
      datasetInstances: Object.freeze(datasetInstances),
      issues: Object.freeze(issues),
    });
  }
}
