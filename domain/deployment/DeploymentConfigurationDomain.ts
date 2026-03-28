import { createHash } from "node:crypto";
import { DeploymentTargetId, type DeploymentTargetType } from "./DeploymentTargetDomain";

export class DeploymentConfigurationId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): DeploymentConfigurationId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("DeploymentConfigurationId cannot be empty.");
    }
    return new DeploymentConfigurationId(normalized);
  }
}

export interface DeploymentConfigurationSchema {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly requiredDeploymentSettings: ReadonlyArray<string>;
  readonly optionalDeploymentSettings: ReadonlyArray<string>;
  readonly requiredRuntimeSettings: ReadonlyArray<string>;
  readonly optionalRuntimeSettings: ReadonlyArray<string>;
}

export interface DeploymentConfigurationValueSet {
  readonly deploymentSettings: Readonly<Record<string, string>>;
  readonly runtimeSettings: Readonly<Record<string, string>>;
}

export interface NestedDeploymentConfigurationBinding {
  readonly systemAssetId: string;
  readonly systemVersionId?: string;
  readonly valueSet?: DeploymentConfigurationValueSet;
}

export interface DeploymentConfigurationContract {
  readonly configurationId: DeploymentConfigurationId;
  readonly packageId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly targetId: DeploymentTargetId;
  readonly targetType: DeploymentTargetType;
  readonly schema: DeploymentConfigurationSchema;
  readonly valueSet: DeploymentConfigurationValueSet;
  readonly nestedSystemBindings: ReadonlyArray<NestedDeploymentConfigurationBinding>;
  readonly metadata: {
    readonly createdAt: string;
    readonly deterministicKey: string;
  };
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeUniqueList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))]);
}

function normalizeRecord(input?: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const entries = Object.entries(input ?? {})
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key && value)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.freeze(Object.fromEntries(entries));
}

function toDeterminismPayload(input: {
  readonly packageId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly targetId: string;
  readonly targetType: DeploymentTargetType;
  readonly schema: DeploymentConfigurationSchema;
  readonly valueSet: DeploymentConfigurationValueSet;
  readonly nestedSystemBindings: ReadonlyArray<NestedDeploymentConfigurationBinding>;
}): string {
  const nested = [...input.nestedSystemBindings]
    .map((entry) => Object.freeze({
      systemAssetId: entry.systemAssetId,
      systemVersionId: entry.systemVersionId,
      deploymentSettings: entry.valueSet?.deploymentSettings ?? {},
      runtimeSettings: entry.valueSet?.runtimeSettings ?? {},
    }))
    .sort((left, right) => `${left.systemAssetId}:${left.systemVersionId ?? ""}`.localeCompare(`${right.systemAssetId}:${right.systemVersionId ?? ""}`));

  return JSON.stringify({
    packageId: input.packageId,
    rootSystemAssetId: input.rootSystemAssetId,
    rootSystemVersionId: input.rootSystemVersionId,
    targetId: input.targetId,
    targetType: input.targetType,
    schema: input.schema,
    valueSet: input.valueSet,
    nested,
  });
}

export function createDeploymentConfigurationSchema(input: DeploymentConfigurationSchema): DeploymentConfigurationSchema {
  const requiredDeploymentSettings = normalizeUniqueList(input.requiredDeploymentSettings);
  const optionalDeploymentSettings = normalizeUniqueList(input.optionalDeploymentSettings);
  const requiredRuntimeSettings = normalizeUniqueList(input.requiredRuntimeSettings);
  const optionalRuntimeSettings = normalizeUniqueList(input.optionalRuntimeSettings);

  const deploymentOverlap = requiredDeploymentSettings.filter((entry) => optionalDeploymentSettings.includes(entry));
  if (deploymentOverlap.length > 0) {
    throw new Error(`Deployment configuration schema contains duplicate deployment settings: ${deploymentOverlap.join(", ")}.`);
  }

  const runtimeOverlap = requiredRuntimeSettings.filter((entry) => optionalRuntimeSettings.includes(entry));
  if (runtimeOverlap.length > 0) {
    throw new Error(`Deployment configuration schema contains duplicate runtime settings: ${runtimeOverlap.join(", ")}.`);
  }

  return Object.freeze({
    schemaId: normalizeRequired(input.schemaId, "Deployment configuration schema id"),
    schemaVersion: normalizeRequired(input.schemaVersion, "Deployment configuration schema version"),
    requiredDeploymentSettings,
    optionalDeploymentSettings,
    requiredRuntimeSettings,
    optionalRuntimeSettings,
  });
}

export function createDeploymentConfigurationValueSet(input?: DeploymentConfigurationValueSet): DeploymentConfigurationValueSet {
  return Object.freeze({
    deploymentSettings: normalizeRecord(input?.deploymentSettings),
    runtimeSettings: normalizeRecord(input?.runtimeSettings),
  });
}

export function createDeploymentConfigurationContract(input: {
  readonly configurationId: string;
  readonly packageId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly targetId: string;
  readonly targetType: DeploymentTargetType;
  readonly schema: DeploymentConfigurationSchema;
  readonly valueSet: DeploymentConfigurationValueSet;
  readonly nestedSystemBindings?: ReadonlyArray<NestedDeploymentConfigurationBinding>;
  readonly createdAt: string;
}): DeploymentConfigurationContract {
  const schema = createDeploymentConfigurationSchema(input.schema);
  const valueSet = createDeploymentConfigurationValueSet(input.valueSet);
  const nestedSystemBindings = Object.freeze((input.nestedSystemBindings ?? []).map((entry) => Object.freeze({
    systemAssetId: normalizeRequired(entry.systemAssetId, "Nested deployment binding system asset id"),
    systemVersionId: entry.systemVersionId?.trim() || undefined,
    valueSet: entry.valueSet ? createDeploymentConfigurationValueSet(entry.valueSet) : undefined,
  })));

  const determinismPayload = toDeterminismPayload({
    packageId: input.packageId.trim(),
    rootSystemAssetId: input.rootSystemAssetId.trim(),
    rootSystemVersionId: input.rootSystemVersionId.trim(),
    targetId: input.targetId.trim(),
    targetType: input.targetType,
    schema,
    valueSet,
    nestedSystemBindings,
  });
  const deterministicKey = createHash("sha256").update(determinismPayload).digest("hex");

  return Object.freeze({
    configurationId: DeploymentConfigurationId.from(input.configurationId),
    packageId: normalizeRequired(input.packageId, "Deployment configuration package id"),
    rootSystemAssetId: normalizeRequired(input.rootSystemAssetId, "Deployment configuration root system asset id"),
    rootSystemVersionId: normalizeRequired(input.rootSystemVersionId, "Deployment configuration root system version id"),
    targetId: DeploymentTargetId.from(input.targetId),
    targetType: input.targetType,
    schema,
    valueSet,
    nestedSystemBindings,
    metadata: Object.freeze({
      createdAt: normalizeRequired(input.createdAt, "Deployment configuration createdAt"),
      deterministicKey,
    }),
  });
}
