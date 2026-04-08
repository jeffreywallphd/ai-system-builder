import type {
  DeploymentPolicyScalarValue,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type {
  DeploymentPolicyValidationOutcome,
  DeploymentPolicyValueKind,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyValueKinds,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  DeploymentPolicyActiveProfileSelectionRecord,
  DeploymentPolicyEffectiveMetadataRecord,
  DeploymentPolicyOverrideHistoryOperationKind,
  DeploymentPolicyOverrideHistoryRecord,
  DeploymentPolicyOverridePersistenceRecord,
  DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import { createDeploymentPolicyPersistenceScope } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";

export interface DeploymentPolicyActiveProfileSelectionRow {
  readonly scope_kind: string;
  readonly scope_id: string;
  readonly profile_id: string;
  readonly changed_at: string;
  readonly changed_by_user_identity_id: string;
  readonly reason?: string | null;
  readonly ticket_reference?: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface DeploymentPolicyOverrideRow {
  readonly scope_kind: string;
  readonly scope_id: string;
  readonly profile_id: string;
  readonly family_id: string;
  readonly setting_key: string;
  readonly value_type: DeploymentPolicyValueKind;
  readonly value_string?: string | null;
  readonly value_number?: number | null;
  readonly value_boolean?: number | null;
  readonly provenance_actor_user_identity_id?: string | null;
  readonly provenance_ticket_reference?: string | null;
  readonly provenance_reason?: string | null;
  readonly provenance_updated_at?: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface DeploymentPolicyOverrideHistoryRow {
  readonly change_id: string;
  readonly scope_kind: string;
  readonly scope_id: string;
  readonly profile_id: string;
  readonly family_id: string;
  readonly setting_key: string;
  readonly operation: DeploymentPolicyOverrideHistoryOperationKind;
  readonly value_type?: DeploymentPolicyValueKind | null;
  readonly value_string?: string | null;
  readonly value_number?: number | null;
  readonly value_boolean?: number | null;
  readonly provenance_actor_user_identity_id?: string | null;
  readonly provenance_ticket_reference?: string | null;
  readonly provenance_reason?: string | null;
  readonly provenance_updated_at?: string | null;
  readonly operation_key: string;
  readonly changed_at: string;
  readonly changed_by_user_identity_id: string;
  readonly reason?: string | null;
  readonly ticket_reference?: string | null;
  readonly correlation_id?: string | null;
  readonly revision: number;
}

export interface DeploymentPolicyEffectiveMetadataRow {
  readonly scope_kind: string;
  readonly scope_id: string;
  readonly profile_id: string;
  readonly evaluated_at: string;
  readonly evaluation_layer: "domain" | "application";
  readonly contract_version: string;
  readonly family_count: number;
  readonly setting_count: number;
  readonly source_counts_json: string;
  readonly validation_json: string;
  readonly recorded_at: string;
  readonly recorded_by_user_identity_id: string;
  readonly revision: number;
}

function toScope(row: { readonly scope_kind: string; readonly scope_id: string }): DeploymentPolicyPersistenceScope {
  return createDeploymentPolicyPersistenceScope({
    kind: row.scope_kind as DeploymentPolicyPersistenceScope["kind"],
    scopeId: row.scope_id,
  });
}

function toNullable(value?: string | null): string | undefined {
  return value ?? undefined;
}

function toScalarValue(input: {
  readonly valueType: DeploymentPolicyValueKind;
  readonly valueString?: string | null;
  readonly valueNumber?: number | null;
  readonly valueBoolean?: number | null;
}): DeploymentPolicyScalarValue {
  if (input.valueType === DeploymentPolicyValueKinds.string) {
    if (typeof input.valueString !== "string") {
      throw new Error("Deployment policy persistence row is missing string value.");
    }
    return input.valueString;
  }
  if (input.valueType === DeploymentPolicyValueKinds.number) {
    if (typeof input.valueNumber !== "number") {
      throw new Error("Deployment policy persistence row is missing numeric value.");
    }
    return input.valueNumber;
  }
  if (input.valueType === DeploymentPolicyValueKinds.boolean) {
    if (input.valueBoolean !== 0 && input.valueBoolean !== 1) {
      throw new Error("Deployment policy persistence row is missing boolean value.");
    }
    return input.valueBoolean === 1;
  }
  throw new Error(`Unsupported deployment policy value type '${String(input.valueType)}'.`);
}

function toValueColumns(value: DeploymentPolicyScalarValue): {
  readonly valueType: DeploymentPolicyValueKind;
  readonly valueString: string | null;
  readonly valueNumber: number | null;
  readonly valueBoolean: number | null;
} {
  const valueType = typeof value as DeploymentPolicyValueKind;
  if (valueType === DeploymentPolicyValueKinds.string) {
    return Object.freeze({
      valueType,
      valueString: value,
      valueNumber: null,
      valueBoolean: null,
    });
  }
  if (valueType === DeploymentPolicyValueKinds.number) {
    return Object.freeze({
      valueType,
      valueString: null,
      valueNumber: value,
      valueBoolean: null,
    });
  }
  if (valueType === DeploymentPolicyValueKinds.boolean) {
    return Object.freeze({
      valueType,
      valueString: null,
      valueNumber: null,
      valueBoolean: value ? 1 : 0,
    });
  }
  throw new Error(`Unsupported deployment policy scalar value type '${typeof value}'.`);
}

function parseJson<T>(label: string, value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Deployment policy persistence contains invalid ${label} JSON payload.`);
  }
}

export function mapActiveProfileSelectionRowToRecord(
  row: DeploymentPolicyActiveProfileSelectionRow,
): DeploymentPolicyActiveProfileSelectionRecord {
  return Object.freeze({
    scope: toScope(row),
    profileId: row.profile_id as DeploymentPolicyActiveProfileSelectionRecord["profileId"],
    changedAt: row.changed_at,
    changedByUserIdentityId: row.changed_by_user_identity_id,
    reason: toNullable(row.reason),
    ticketReference: toNullable(row.ticket_reference),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  });
}

export function mapActiveProfileSelectionRecordToRowValues(
  record: DeploymentPolicyActiveProfileSelectionRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.scope.kind,
    record.scope.scopeId,
    record.profileId,
    record.changedAt,
    record.changedByUserIdentityId,
    record.reason ?? null,
    record.ticketReference ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapOverrideRowToRecord(row: DeploymentPolicyOverrideRow): DeploymentPolicyOverridePersistenceRecord {
  return Object.freeze({
    scope: toScope(row),
    profileId: row.profile_id as DeploymentPolicyOverridePersistenceRecord["profileId"],
    familyId: row.family_id,
    settingKey: row.setting_key,
    valueType: row.value_type,
    value: toScalarValue({
      valueType: row.value_type,
      valueString: row.value_string,
      valueNumber: row.value_number,
      valueBoolean: row.value_boolean,
    }),
    provenance: row.provenance_actor_user_identity_id
      || row.provenance_ticket_reference
      || row.provenance_reason
      || row.provenance_updated_at
      ? Object.freeze({
        actorUserIdentityId: toNullable(row.provenance_actor_user_identity_id),
        ticketReference: toNullable(row.provenance_ticket_reference),
        reason: toNullable(row.provenance_reason),
        updatedAt: toNullable(row.provenance_updated_at),
      })
      : undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  });
}

export function mapOverrideRecordToRowValues(record: DeploymentPolicyOverridePersistenceRecord): ReadonlyArray<unknown> {
  const valueColumns = toValueColumns(record.value);
  return Object.freeze([
    record.scope.kind,
    record.scope.scopeId,
    record.profileId,
    record.familyId,
    record.settingKey,
    valueColumns.valueType,
    valueColumns.valueString,
    valueColumns.valueNumber,
    valueColumns.valueBoolean,
    record.provenance?.actorUserIdentityId ?? null,
    record.provenance?.ticketReference ?? null,
    record.provenance?.reason ?? null,
    record.provenance?.updatedAt ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapOverrideHistoryRowToRecord(
  row: DeploymentPolicyOverrideHistoryRow,
): DeploymentPolicyOverrideHistoryRecord {
  const value = row.value_type
    ? toScalarValue({
      valueType: row.value_type,
      valueString: row.value_string,
      valueNumber: row.value_number,
      valueBoolean: row.value_boolean,
    })
    : undefined;

  return Object.freeze({
    changeId: row.change_id,
    scope: toScope(row),
    profileId: row.profile_id as DeploymentPolicyOverrideHistoryRecord["profileId"],
    familyId: row.family_id,
    settingKey: row.setting_key,
    operation: row.operation,
    value,
    valueType: row.value_type ?? undefined,
    provenance: row.provenance_actor_user_identity_id
      || row.provenance_ticket_reference
      || row.provenance_reason
      || row.provenance_updated_at
      ? Object.freeze({
        actorUserIdentityId: toNullable(row.provenance_actor_user_identity_id),
        ticketReference: toNullable(row.provenance_ticket_reference),
        reason: toNullable(row.provenance_reason),
        updatedAt: toNullable(row.provenance_updated_at),
      })
      : undefined,
    operationKey: row.operation_key,
    changedAt: row.changed_at,
    changedByUserIdentityId: row.changed_by_user_identity_id,
    reason: toNullable(row.reason),
    ticketReference: toNullable(row.ticket_reference),
    correlationId: toNullable(row.correlation_id),
    revision: row.revision,
  });
}

export function mapOverrideHistoryRecordToRowValues(
  record: DeploymentPolicyOverrideHistoryRecord,
): ReadonlyArray<unknown> {
  const valueColumns = record.value !== undefined
    ? toValueColumns(record.value)
    : Object.freeze({
      valueType: null,
      valueString: null,
      valueNumber: null,
      valueBoolean: null,
    });

  return Object.freeze([
    record.changeId,
    record.scope.kind,
    record.scope.scopeId,
    record.profileId,
    record.familyId,
    record.settingKey,
    record.operation,
    valueColumns.valueType,
    valueColumns.valueString,
    valueColumns.valueNumber,
    valueColumns.valueBoolean,
    record.provenance?.actorUserIdentityId ?? null,
    record.provenance?.ticketReference ?? null,
    record.provenance?.reason ?? null,
    record.provenance?.updatedAt ?? null,
    record.operationKey,
    record.changedAt,
    record.changedByUserIdentityId,
    record.reason ?? null,
    record.ticketReference ?? null,
    record.correlationId ?? null,
    record.revision,
    record.changedAt,
  ]);
}

export function mapEffectiveMetadataRowToRecord(
  row: DeploymentPolicyEffectiveMetadataRow,
): DeploymentPolicyEffectiveMetadataRecord {
  return Object.freeze({
    scope: toScope(row),
    profileId: row.profile_id as DeploymentPolicyEffectiveMetadataRecord["profileId"],
    evaluatedAt: row.evaluated_at,
    evaluationLayer: row.evaluation_layer,
    contractVersion: row.contract_version as DeploymentPolicyEffectiveMetadataRecord["contractVersion"],
    familyCount: row.family_count,
    settingCount: row.setting_count,
    sourceCounts: Object.freeze(parseJson<DeploymentPolicyEffectiveMetadataRecord["sourceCounts"]>(
      "sourceCounts",
      row.source_counts_json,
    )),
    validation: parseJson<DeploymentPolicyValidationOutcome>("validation", row.validation_json),
    recordedAt: row.recorded_at,
    recordedByUserIdentityId: row.recorded_by_user_identity_id,
    revision: row.revision,
  });
}

export function mapEffectiveMetadataRecordToRowValues(
  record: DeploymentPolicyEffectiveMetadataRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.scope.kind,
    record.scope.scopeId,
    record.profileId,
    record.evaluatedAt,
    record.evaluationLayer,
    record.contractVersion,
    record.familyCount,
    record.settingCount,
    JSON.stringify(record.sourceCounts),
    JSON.stringify(record.validation),
    record.recordedAt,
    record.recordedByUserIdentityId,
    record.revision,
  ]);
}

