import type { DatasetInstance, DatasetInstanceRole } from "@domain/system-runtime/DatasetInstanceDomain";
import type { DatasetInstanceImageRecord } from "@domain/system-runtime/DatasetInstanceRecordDomain";

export interface DatasetInstanceStorageAdapter {
  saveInstance(instance: DatasetInstance): DatasetInstance;
  getInstanceById(instanceId: string): DatasetInstance | undefined;
  getInstanceBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance | undefined;
  deleteInstanceById(instanceId: string): boolean;
  listInstancesBySystemId(systemId: string): ReadonlyArray<DatasetInstance>;
  findInstanceBySystemAndRole(input: {
    readonly systemId: string;
    readonly role: DatasetInstanceRole;
    readonly purpose?: string;
  }): DatasetInstance | undefined;

  saveImageRecord(record: DatasetInstanceImageRecord): DatasetInstanceImageRecord;
  getImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined;
  getImageRecordBySystemAndId(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly recordId: string;
  }): DatasetInstanceImageRecord | undefined;
  deleteImageRecordById(input: {
    readonly instanceId: string;
    readonly recordId: string;
  }): boolean;
  deleteImageRecordsByInstanceId(instanceId: string): number;
  listImageRecordsByInstanceId(instanceId: string): ReadonlyArray<DatasetInstanceImageRecord>;
  listImageRecordsBySystemId(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): ReadonlyArray<DatasetInstanceImageRecord>;
}

