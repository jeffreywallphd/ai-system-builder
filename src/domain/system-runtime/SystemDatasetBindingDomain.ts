import {
  DatasetInstanceRoles,
  type DatasetInstance,
  type DatasetInstanceRole,
} from "./DatasetInstanceDomain";

export const SystemDatasetBindingRoles = Object.freeze({
  input: "input",
  output: "output",
  intermediate: "intermediate",
} as const);

export type SystemDatasetBindingRole =
  typeof SystemDatasetBindingRoles[keyof typeof SystemDatasetBindingRoles];

export interface SystemDatasetBinding {
  readonly systemId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: SystemDatasetBindingRole;
  readonly purpose?: string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

export function mapDatasetInstanceRoleToSystemBindingRole(role: DatasetInstanceRole): SystemDatasetBindingRole {
  if (role === DatasetInstanceRoles.inputStore) {
    return SystemDatasetBindingRoles.input;
  }
  if (role === DatasetInstanceRoles.outputStore) {
    return SystemDatasetBindingRoles.output;
  }
  if (role === DatasetInstanceRoles.intermediateStore) {
    return SystemDatasetBindingRoles.intermediate;
  }

  throw new Error(`Dataset instance role '${role}' cannot be mapped to a system dataset binding role.`);
}

export function mapSystemBindingRoleToDatasetInstanceRole(role: SystemDatasetBindingRole): DatasetInstanceRole {
  if (role === SystemDatasetBindingRoles.input) {
    return DatasetInstanceRoles.inputStore;
  }
  if (role === SystemDatasetBindingRoles.output) {
    return DatasetInstanceRoles.outputStore;
  }
  if (role === SystemDatasetBindingRoles.intermediate) {
    return DatasetInstanceRoles.intermediateStore;
  }

  throw new Error(`System dataset binding role '${role}' is not supported.`);
}

export function createSystemDatasetBinding(input: {
  readonly systemId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: SystemDatasetBindingRole;
  readonly purpose?: string;
}): SystemDatasetBinding {
  return Object.freeze({
    systemId: normalizeRequired(input.systemId, "System dataset binding system id"),
    instanceId: normalizeRequired(input.instanceId, "System dataset binding instance id"),
    datasetAssetId: normalizeRequired(input.datasetAssetId, "System dataset binding dataset asset id"),
    datasetAssetVersionId: normalizeOptional(input.datasetAssetVersionId),
    role: input.role,
    purpose: normalizeOptional(input.purpose),
  });
}

export function createSystemDatasetBindingFromInstance(instance: DatasetInstance): SystemDatasetBinding {
  return createSystemDatasetBinding({
    systemId: instance.systemId,
    instanceId: instance.instanceId,
    datasetAssetId: instance.datasetAssetId,
    datasetAssetVersionId: instance.datasetAssetVersionId,
    role: mapDatasetInstanceRoleToSystemBindingRole(instance.role),
    purpose: instance.purpose,
  });
}
