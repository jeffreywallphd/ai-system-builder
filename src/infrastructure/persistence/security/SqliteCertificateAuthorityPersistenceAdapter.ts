import fs from "node:fs";
import path from "node:path";
import type { ICertificateAuthorityRootPersistenceRepository } from "@application/security/ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateLifecycleEventPersistenceRepository } from "@application/security/ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "@application/security/ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "@application/security/ports/ITrustMaterialReferencePersistenceRepository";
import { CertificateStatuses } from "@domain/security/CertificateAuthorityDomain";
import {
  normalizeCertificateAuthorityMutationOperationKey,
  type AppendCertificateStatusHistoryPersistenceRecordInput,
  type CertificateAuthorityPersistenceMutationResult,
  type CertificateAuthorityRootLookupQuery,
  type CertificateAuthorityRootPersistenceRecord,
  type CertificateDistributionEventLookupQuery,
  type CertificateDistributionEventPersistenceRecord,
  type CertificateRevocationHistoryLookupQuery,
  type CertificateRevocationHistoryPersistenceRecord,
  type CertificateStatusHistoryLookupQuery,
  type CertificateStatusHistoryPersistenceRecord,
  type IssuedCertificateLookupQuery,
  type IssuedCertificatePersistenceRecord,
  type RevokeIssuedCertificatePersistenceRecordInput,
  type SaveCertificateAuthorityRootPersistenceRecordInput,
  type SaveCertificateDistributionEventPersistenceRecordInput,
  type SaveCertificateRevocationHistoryPersistenceRecordInput,
  type SaveIssuedCertificatePersistenceRecordInput,
  type SaveTrustMaterialReferencePersistenceRecordInput,
  type SupersedeIssuedCertificatePersistenceRecordInput,
  type TrustMaterialReferenceLookupQuery,
  type TrustMaterialReferencePersistenceRecord,
  type UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  type UpdateCertificateAuthorityStatusPersistenceRecordInput,
} from "@shared/dto/security/CertificateAuthorityDtos";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapCertificateAuthorityRootRecordToRowValues,
  mapCertificateAuthorityRootRowToRecord,
  mapCertificateDistributionEventRecordToRowValues,
  mapCertificateDistributionEventRowToRecord,
  mapCertificateRevocationRecordToRowValues,
  mapCertificateRevocationRowToRecord,
  mapCertificateStatusHistoryRecordToRowValues,
  mapCertificateStatusHistoryRowToRecord,
  mapIssuedCertificateRecordToRowValues,
  mapIssuedCertificateRowToRecord,
  mapTrustMaterialReferenceRecordToRowValues,
  mapTrustMaterialReferenceRowToRecord,
  normalizeCertificateLookup,
  parseCertificateMutationReplayRecord,
  type CertificateAuthorityRootRow,
  type CertificateDistributionEventRow,
  type CertificateMutationReplayRow,
  type CertificateRevocationRow,
  type CertificateStatusHistoryRow,
  type IssuedCertificateRow,
  type TrustMaterialReferenceRow,
} from "./CertificateAuthorityPersistenceMapper";
import {
  CERTIFICATE_AUTHORITY_PERSISTENCE_MIGRATIONS,
  CERTIFICATE_AUTHORITY_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteCertificateAuthorityPersistenceMigrations";

type MutationKind =
  | "certificate-authority"
  | "issued-certificate"
  | "trust-material"
  | "status-history"
  | "certificate-revocation"
  | "distribution-event";

export class SqliteCertificateAuthorityPersistenceAdapter
  implements
    ICertificateAuthorityRootPersistenceRepository,
    IIssuedCertificatePersistenceRepository,
    ITrustMaterialReferencePersistenceRepository,
    ICertificateLifecycleEventPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async findCertificateAuthorityById(id: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    const normalized = normalizeCertificateLookup(id);
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase().prepare("SELECT * FROM certificate_authorities WHERE certificate_authority_id = ? LIMIT 1")
      .get(normalized) as CertificateAuthorityRootRow | undefined;
    return row ? mapCertificateAuthorityRootRowToRecord(row) : undefined;
  }

  public async findActiveCertificateAuthority(asOf?: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    const cursor = asOf?.trim() || new Date().toISOString();
    const row = this.getDatabase().prepare(
      "SELECT * FROM certificate_authorities WHERE status='active' AND validity_not_before <= ? AND validity_not_after > ? ORDER BY validity_not_after DESC LIMIT 1",
    ).get(cursor, cursor) as CertificateAuthorityRootRow | undefined;
    return row ? mapCertificateAuthorityRootRowToRecord(row) : undefined;
  }

  public async listCertificateAuthorities(
    query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.statuses?.length) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }
    if (!(query.includeRetired ?? false)) {
      clauses.push("status != 'retired'");
    }
    if (!(query.includeCompromised ?? false)) {
      clauses.push("status != 'compromised'");
    }
    if (query.activeAt) {
      clauses.push("validity_not_before <= ? AND validity_not_after > ?");
      params.push(query.activeAt, query.activeAt);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(
      `SELECT * FROM certificate_authorities ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC ${paging.sql}`,
    ).all(...params, ...paging.params) as CertificateAuthorityRootRow[];
    return Object.freeze(rows.map(mapCertificateAuthorityRootRowToRecord));
  }

  public async saveCertificateAuthority(
    input: SaveCertificateAuthorityRootPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    return this.persistWithReplay("certificate-authority", input.mutation.operationKey, () => {
      const candidate = {
        ...input.record,
        serialNumber: this.toSerial(input.record.serialNumber) as string,
      };
      const existing = this.getCertificateAuthorityByIdInternal(candidate.certificateAuthorityId);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Certificate authority");
      const now = this.resolveMutationTimestamp(input.mutation.context.occurredAt);
      const record: CertificateAuthorityRootPersistenceRecord = Object.freeze({
        ...candidate,
        createdAt: existing?.createdAt ?? candidate.createdAt,
        createdBy: existing?.createdBy ?? candidate.createdBy,
        lastModifiedAt: now,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });

      this.getDatabase().prepare(`
        INSERT INTO certificate_authorities (
          certificate_authority_id, display_name, status, subject_json, serial_number,
          validity_not_before, validity_not_after, signature_algorithm,
          root_certificate_material_ref, root_private_key_material_ref, rotation_policy_json,
          rotated_from_certificate_authority_id, retired_at, compromised_at,
          created_at, created_by, last_modified_at, last_modified_by, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(certificate_authority_id) DO UPDATE SET
          display_name = excluded.display_name,
          status = excluded.status,
          subject_json = excluded.subject_json,
          serial_number = excluded.serial_number,
          validity_not_before = excluded.validity_not_before,
          validity_not_after = excluded.validity_not_after,
          signature_algorithm = excluded.signature_algorithm,
          root_certificate_material_ref = excluded.root_certificate_material_ref,
          root_private_key_material_ref = excluded.root_private_key_material_ref,
          rotation_policy_json = excluded.rotation_policy_json,
          rotated_from_certificate_authority_id = excluded.rotated_from_certificate_authority_id,
          retired_at = excluded.retired_at,
          compromised_at = excluded.compromised_at,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          last_modified_at = excluded.last_modified_at,
          last_modified_by = excluded.last_modified_by,
          revision = excluded.revision
        WHERE excluded.revision > certificate_authorities.revision
      `).run(...mapCertificateAuthorityRootRecordToRowValues(record));

      return record;
    });
  }

  public async updateCertificateAuthorityStatus(
    input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    const existing = await this.findCertificateAuthorityById(input.certificateAuthorityId);
    if (!existing) {
      throw new Error(`Certificate authority '${input.certificateAuthorityId}' was not found.`);
    }

    return this.saveCertificateAuthority({
      mutation: input.mutation,
      record: {
        ...existing,
        status: input.status,
        retiredAt: input.retiredAt ?? existing.retiredAt,
        compromisedAt: input.compromisedAt ?? existing.compromisedAt,
      },
    });
  }

  public async updateCertificateAuthorityRotationPolicy(
    input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    const existing = await this.findCertificateAuthorityById(input.certificateAuthorityId);
    if (!existing) {
      throw new Error(`Certificate authority '${input.certificateAuthorityId}' was not found.`);
    }

    return this.saveCertificateAuthority({
      mutation: input.mutation,
      record: {
        ...existing,
        rotationPolicy: input.rotationPolicy,
      },
    });
  }

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    const normalized = this.toSerial(serialNumber);
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase().prepare("SELECT * FROM issued_certificates WHERE serial_number = ? LIMIT 1")
      .get(normalized) as IssuedCertificateRow | undefined;
    return row ? mapIssuedCertificateRowToRecord(row) : undefined;
  }

  public async findLatestIssuedCertificateBySubjectReference(input: {
    readonly kind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
    readonly referenceId: string;
    readonly workspaceId?: string;
  }): Promise<IssuedCertificatePersistenceRecord | undefined> {
    const referenceId = normalizeCertificateLookup(input.referenceId);
    if (!referenceId) {
      return undefined;
    }
    const workspaceId = normalizeCertificateLookup(input.workspaceId ?? "");

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM issued_certificates
      WHERE subject_reference_kind = ?
        AND subject_reference_id = ?
        AND ${workspaceId ? "subject_reference_workspace_id = ?" : "subject_reference_workspace_id IS NULL"}
      ORDER BY issued_at DESC
      LIMIT 1
    `).get(...(workspaceId ? [input.kind, referenceId, workspaceId] : [input.kind, referenceId])) as
      | IssuedCertificateRow
      | undefined;

    return row ? mapIssuedCertificateRowToRecord(row) : undefined;
  }

  public async listIssuedCertificates(query: IssuedCertificateLookupQuery): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.certificateAuthorityId) {
      clauses.push("certificate_authority_id = ?");
      params.push(query.certificateAuthorityId);
    }
    if (query.statuses?.length) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }
    if (query.subjectReferenceKinds?.length) {
      clauses.push(`subject_reference_kind IN (${query.subjectReferenceKinds.map(() => "?").join(", ")})`);
      params.push(...query.subjectReferenceKinds);
    }
    if (query.subjectReferenceId) {
      clauses.push("subject_reference_id = ?");
      params.push(query.subjectReferenceId);
    }
    if (!(query.includeRevoked ?? false)) {
      clauses.push("status != ?");
      params.push(CertificateStatuses.revoked);
    }
    if (query.validAt) {
      clauses.push("validity_not_before <= ? AND validity_not_after > ?");
      params.push(query.validAt, query.validAt);
    }
    if (query.issuedAfter) {
      clauses.push("issued_at >= ?");
      params.push(query.issuedAfter);
    }
    if (query.issuedBefore) {
      clauses.push("issued_at <= ?");
      params.push(query.issuedBefore);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(
      `SELECT * FROM issued_certificates ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY issued_at DESC ${paging.sql}`,
    ).all(...params, ...paging.params) as IssuedCertificateRow[];

    return Object.freeze(rows
      .map(mapIssuedCertificateRowToRecord)
      .filter((record) => query.usageAnyOf?.length ? query.usageAnyOf.some((usage) => record.usages.includes(usage)) : true));
  }

  public async saveIssuedCertificate(
    input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    return this.persistWithReplay("issued-certificate", input.mutation.operationKey, () => {
      const serial = this.toSerial(input.record.serialNumber);
      if (!serial) {
        throw new Error("Issued certificate serialNumber is required.");
      }
      const existing = this.getIssuedCertificateBySerialInternal(serial);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Issued certificate");

      const now = this.resolveMutationTimestamp(input.mutation.context.occurredAt);
      const record: IssuedCertificatePersistenceRecord = Object.freeze({
        ...input.record,
        serialNumber: serial,
        supersededBySerialNumber: input.record.supersededBySerialNumber
          ? this.toSerial(input.record.supersededBySerialNumber)
          : undefined,
        createdAt: existing?.createdAt ?? input.record.createdAt,
        createdBy: existing?.createdBy ?? input.record.createdBy,
        lastModifiedAt: now,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });

      this.getDatabase().prepare(`
        INSERT INTO issued_certificates (
          serial_number, certificate_authority_id, status, subject_json,
          subject_reference_kind, subject_reference_id, subject_reference_workspace_id,
          usages_json, validity_not_before, validity_not_after, issued_at,
          certificate_material_ref, certificate_chain_material_ref, trust_material_ref,
          public_key_algorithm, public_key_fingerprint_sha256, revocation_json,
          superseded_by_serial_number, created_at, created_by, last_modified_at, last_modified_by, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(serial_number) DO UPDATE SET
          certificate_authority_id = excluded.certificate_authority_id,
          status = excluded.status,
          subject_json = excluded.subject_json,
          subject_reference_kind = excluded.subject_reference_kind,
          subject_reference_id = excluded.subject_reference_id,
          subject_reference_workspace_id = excluded.subject_reference_workspace_id,
          usages_json = excluded.usages_json,
          validity_not_before = excluded.validity_not_before,
          validity_not_after = excluded.validity_not_after,
          issued_at = excluded.issued_at,
          certificate_material_ref = excluded.certificate_material_ref,
          certificate_chain_material_ref = excluded.certificate_chain_material_ref,
          trust_material_ref = excluded.trust_material_ref,
          public_key_algorithm = excluded.public_key_algorithm,
          public_key_fingerprint_sha256 = excluded.public_key_fingerprint_sha256,
          revocation_json = excluded.revocation_json,
          superseded_by_serial_number = excluded.superseded_by_serial_number,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          last_modified_at = excluded.last_modified_at,
          last_modified_by = excluded.last_modified_by,
          revision = excluded.revision
        WHERE excluded.revision > issued_certificates.revision
      `).run(...mapIssuedCertificateRecordToRowValues(record));

      this.upsertStatusEvent(Object.freeze({
        statusEventId: `status:${record.serialNumber}:${record.revision}`,
        certificateAuthorityId: record.certificateAuthorityId,
        serialNumber: record.serialNumber,
        previousStatus: existing?.status,
        currentStatus: record.status,
        occurredAt: now,
        occurredBy: input.mutation.context.actorUserIdentityId,
        reason: existing ? "issued-certificate-update" : "issued-certificate-create",
      }));

      if (record.status === CertificateStatuses.revoked && record.revocation) {
        this.upsertRevocationRecord(Object.freeze({
          revocationId: `revocation:${record.serialNumber}:${Date.parse(record.revocation.revokedAt)}`,
          certificateAuthorityId: record.certificateAuthorityId,
          serialNumber: record.serialNumber,
          reason: record.revocation.reason,
          revokedAt: record.revocation.revokedAt,
          revokedByActorId: record.revocation.revokedByActorId,
          note: record.revocation.note,
          createdAt: existing?.createdAt ?? now,
          createdBy: existing?.createdBy ?? input.mutation.context.actorUserIdentityId,
          lastModifiedAt: now,
          lastModifiedBy: input.mutation.context.actorUserIdentityId,
          revision: 1,
        }));
      }

      return record;
    });
  }
  public async revokeIssuedCertificate(
    input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    const existing = await this.findIssuedCertificateBySerialNumber(input.serialNumber);
    if (!existing) {
      throw new Error(`Issued certificate '${input.serialNumber}' was not found.`);
    }

    return this.saveIssuedCertificate({
      mutation: input.mutation,
      record: {
        ...existing,
        status: CertificateStatuses.revoked,
        revocation: input.revocation,
        supersededBySerialNumber: undefined,
      },
    });
  }

  public async supersedeIssuedCertificate(
    input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    const existing = await this.findIssuedCertificateBySerialNumber(input.serialNumber);
    if (!existing) {
      throw new Error(`Issued certificate '${input.serialNumber}' was not found.`);
    }

    return this.saveIssuedCertificate({
      mutation: input.mutation,
      record: {
        ...existing,
        status: CertificateStatuses.superseded,
        revocation: undefined,
        supersededBySerialNumber: this.toSerial(input.supersededBySerialNumber),
      },
    });
  }

  public async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    const normalized = normalizeCertificateLookup(materialRef);
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase().prepare("SELECT * FROM trust_material_references WHERE material_ref = ? LIMIT 1")
      .get(normalized) as TrustMaterialReferenceRow | undefined;
    return row ? mapTrustMaterialReferenceRowToRecord(row) : undefined;
  }

  public async listTrustMaterials(
    query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.kinds?.length) {
      clauses.push(`kind IN (${query.kinds.map(() => "?").join(", ")})`);
      params.push(...query.kinds);
    }
    if (query.materialRefPrefix) {
      clauses.push("material_ref LIKE ?");
      params.push(`${query.materialRefPrefix}%`);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(
      `SELECT * FROM trust_material_references ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC ${paging.sql}`,
    ).all(...params, ...paging.params) as TrustMaterialReferenceRow[];
    return Object.freeze(rows.map(mapTrustMaterialReferenceRowToRecord));
  }

  public async saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    return this.persistWithReplay("trust-material", input.mutation.operationKey, () => {
      const existing = this.getTrustMaterialByRefInternal(input.record.materialRef);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Trust material reference");
      const now = this.resolveMutationTimestamp(input.mutation.context.occurredAt);

      const record: TrustMaterialReferencePersistenceRecord = Object.freeze({
        ...input.record,
        createdAt: existing?.createdAt ?? input.record.createdAt,
        createdBy: existing?.createdBy ?? input.record.createdBy,
        lastModifiedAt: now,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });

      this.getDatabase().prepare(`
        INSERT INTO trust_material_references (
          material_ref, kind, storage_locator, fingerprint_sha256,
          created_at, created_by, last_modified_at, last_modified_by, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(material_ref) DO UPDATE SET
          kind = excluded.kind,
          storage_locator = excluded.storage_locator,
          fingerprint_sha256 = excluded.fingerprint_sha256,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          last_modified_at = excluded.last_modified_at,
          last_modified_by = excluded.last_modified_by,
          revision = excluded.revision
        WHERE excluded.revision > trust_material_references.revision
      `).run(...mapTrustMaterialReferenceRecordToRowValues(record));

      return record;
    });
  }

  public async findLatestStatusEventBySerialNumber(
    serialNumber: string,
  ): Promise<CertificateStatusHistoryPersistenceRecord | undefined> {
    const normalized = this.toSerial(serialNumber);
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase().prepare(
      "SELECT * FROM certificate_status_history WHERE serial_number = ? ORDER BY occurred_at DESC, status_event_id ASC LIMIT 1",
    ).get(normalized) as CertificateStatusHistoryRow | undefined;
    return row ? mapCertificateStatusHistoryRowToRecord(row) : undefined;
  }

  public async listCertificateStatusHistory(
    query: CertificateStatusHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateStatusHistoryPersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.certificateAuthorityId) {
      clauses.push("certificate_authority_id = ?");
      params.push(query.certificateAuthorityId);
    }
    if (query.serialNumber) {
      clauses.push("serial_number = ?");
      params.push(this.toSerial(query.serialNumber));
    }
    if (query.statuses?.length) {
      clauses.push(`current_status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }
    if (query.occurredAfter) {
      clauses.push("occurred_at >= ?");
      params.push(query.occurredAfter);
    }
    if (query.occurredBefore) {
      clauses.push("occurred_at <= ?");
      params.push(query.occurredBefore);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(
      `SELECT * FROM certificate_status_history ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY occurred_at DESC ${paging.sql}`,
    ).all(...params, ...paging.params) as CertificateStatusHistoryRow[];
    return Object.freeze(rows.map(mapCertificateStatusHistoryRowToRecord));
  }

  public async appendCertificateStatusHistory(
    input: AppendCertificateStatusHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateStatusHistoryPersistenceRecord>> {
    return this.persistWithReplay("status-history", input.mutation.operationKey, () => {
      const now = this.resolveMutationTimestamp(input.mutation.context.occurredAt);
      const record: CertificateStatusHistoryPersistenceRecord = Object.freeze({
        ...input.record,
        serialNumber: this.toSerial(input.record.serialNumber) as string,
        occurredAt: now,
        occurredBy: input.mutation.context.actorUserIdentityId,
      });
      this.upsertStatusEvent(record);
      return record;
    });
  }

  public async findLatestCertificateRevocationBySerialNumber(
    serialNumber: string,
  ): Promise<CertificateRevocationHistoryPersistenceRecord | undefined> {
    const normalized = this.toSerial(serialNumber);
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase().prepare(
      "SELECT * FROM certificate_revocations WHERE serial_number = ? ORDER BY revoked_at DESC, revocation_id ASC LIMIT 1",
    ).get(normalized) as CertificateRevocationRow | undefined;
    return row ? mapCertificateRevocationRowToRecord(row) : undefined;
  }

  public async listCertificateRevocations(
    query: CertificateRevocationHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateRevocationHistoryPersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.certificateAuthorityId) {
      clauses.push("certificate_authority_id = ?");
      params.push(query.certificateAuthorityId);
    }
    if (query.serialNumber) {
      clauses.push("serial_number = ?");
      params.push(this.toSerial(query.serialNumber));
    }
    if (query.reasons?.length) {
      clauses.push(`reason IN (${query.reasons.map(() => "?").join(", ")})`);
      params.push(...query.reasons);
    }
    if (query.revokedAfter) {
      clauses.push("revoked_at >= ?");
      params.push(query.revokedAfter);
    }
    if (query.revokedBefore) {
      clauses.push("revoked_at <= ?");
      params.push(query.revokedBefore);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(
      `SELECT * FROM certificate_revocations ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY revoked_at DESC ${paging.sql}`,
    ).all(...params, ...paging.params) as CertificateRevocationRow[];
    return Object.freeze(rows.map(mapCertificateRevocationRowToRecord));
  }

  public async saveCertificateRevocation(
    input: SaveCertificateRevocationHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateRevocationHistoryPersistenceRecord>> {
    return this.persistWithReplay("certificate-revocation", input.mutation.operationKey, () => {
      const existing = this.getCertificateRevocationByIdInternal(input.record.revocationId);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Certificate revocation");
      const now = this.resolveMutationTimestamp(input.mutation.context.occurredAt);

      const record: CertificateRevocationHistoryPersistenceRecord = Object.freeze({
        ...input.record,
        serialNumber: this.toSerial(input.record.serialNumber) as string,
        createdAt: existing?.createdAt ?? input.record.createdAt,
        createdBy: existing?.createdBy ?? input.record.createdBy,
        lastModifiedAt: now,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });
      this.upsertRevocationRecord(record);
      return record;
    });
  }

  public async listCertificateDistributionEvents(
    query: CertificateDistributionEventLookupQuery,
  ): Promise<ReadonlyArray<CertificateDistributionEventPersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.materialRef) {
      clauses.push("material_ref = ?");
      params.push(query.materialRef);
    }
    if (query.certificateAuthorityId) {
      clauses.push("certificate_authority_id = ?");
      params.push(query.certificateAuthorityId);
    }
    if (query.serialNumber) {
      clauses.push("serial_number = ?");
      params.push(this.toSerial(query.serialNumber));
    }
    if (query.targetKinds?.length) {
      clauses.push(`target_kind IN (${query.targetKinds.map(() => "?").join(", ")})`);
      params.push(...query.targetKinds);
    }
    if (query.targetReferenceId) {
      clauses.push("target_reference_id = ?");
      params.push(query.targetReferenceId);
    }
    if (query.workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(query.workspaceId);
    }
    if (query.statuses?.length) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }
    if (query.occurredAfter) {
      clauses.push("occurred_at >= ?");
      params.push(query.occurredAfter);
    }
    if (query.occurredBefore) {
      clauses.push("occurred_at <= ?");
      params.push(query.occurredBefore);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(
      `SELECT * FROM certificate_distribution_events ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY occurred_at DESC ${paging.sql}`,
    ).all(...params, ...paging.params) as CertificateDistributionEventRow[];
    return Object.freeze(rows.map(mapCertificateDistributionEventRowToRecord));
  }

  public async saveCertificateDistributionEvent(
    input: SaveCertificateDistributionEventPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateDistributionEventPersistenceRecord>> {
    return this.persistWithReplay("distribution-event", input.mutation.operationKey, () => {
      const existing = this.getCertificateDistributionEventByIdInternal(input.record.distributionEventId);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Certificate distribution event");
      const now = this.resolveMutationTimestamp(input.mutation.context.occurredAt);

      const record: CertificateDistributionEventPersistenceRecord = Object.freeze({
        ...input.record,
        serialNumber: input.record.serialNumber ? this.toSerial(input.record.serialNumber) : undefined,
        createdAt: existing?.createdAt ?? input.record.createdAt,
        createdBy: existing?.createdBy ?? input.record.createdBy,
        occurredAt: now,
        occurredBy: input.mutation.context.actorUserIdentityId,
        lastModifiedAt: now,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });

      this.getDatabase().prepare(`
        INSERT INTO certificate_distribution_events (
          distribution_event_id, material_ref, certificate_authority_id, serial_number,
          target_kind, target_reference_id, workspace_id, transport, delivery_locator_ref,
          status, occurred_at, occurred_by, failure_reason,
          created_at, created_by, last_modified_at, last_modified_by, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(distribution_event_id) DO UPDATE SET
          material_ref = excluded.material_ref,
          certificate_authority_id = excluded.certificate_authority_id,
          serial_number = excluded.serial_number,
          target_kind = excluded.target_kind,
          target_reference_id = excluded.target_reference_id,
          workspace_id = excluded.workspace_id,
          transport = excluded.transport,
          delivery_locator_ref = excluded.delivery_locator_ref,
          status = excluded.status,
          occurred_at = excluded.occurred_at,
          occurred_by = excluded.occurred_by,
          failure_reason = excluded.failure_reason,
          created_at = excluded.created_at,
          created_by = excluded.created_by,
          last_modified_at = excluded.last_modified_at,
          last_modified_by = excluded.last_modified_by,
          revision = excluded.revision
        WHERE excluded.revision > certificate_distribution_events.revision
      `).run(...mapCertificateDistributionEventRecordToRowValues(record));

      return record;
    });
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }

    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }

    return this.database;
  }

  private initialize(database: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(database);
    if (currentVersion > CERTIFICATE_AUTHORITY_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Certificate authority schema version ${currentVersion} is newer than supported version ${CERTIFICATE_AUTHORITY_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of CERTIFICATE_AUTHORITY_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO certificate_authority_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS certificate_authority_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM certificate_authority_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private getCertificateAuthorityByIdInternal(id: string): CertificateAuthorityRootPersistenceRecord | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM certificate_authorities WHERE certificate_authority_id = ? LIMIT 1")
      .get(id) as CertificateAuthorityRootRow | undefined;
    return row ? mapCertificateAuthorityRootRowToRecord(row) : undefined;
  }

  private getIssuedCertificateBySerialInternal(serialNumber: string): IssuedCertificatePersistenceRecord | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM issued_certificates WHERE serial_number = ? LIMIT 1")
      .get(serialNumber) as IssuedCertificateRow | undefined;
    return row ? mapIssuedCertificateRowToRecord(row) : undefined;
  }

  private getTrustMaterialByRefInternal(materialRef: string): TrustMaterialReferencePersistenceRecord | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM trust_material_references WHERE material_ref = ? LIMIT 1")
      .get(materialRef) as TrustMaterialReferenceRow | undefined;
    return row ? mapTrustMaterialReferenceRowToRecord(row) : undefined;
  }

  private getCertificateRevocationByIdInternal(id: string): CertificateRevocationHistoryPersistenceRecord | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM certificate_revocations WHERE revocation_id = ? LIMIT 1")
      .get(id) as CertificateRevocationRow | undefined;
    return row ? mapCertificateRevocationRowToRecord(row) : undefined;
  }

  private getCertificateDistributionEventByIdInternal(id: string): CertificateDistributionEventPersistenceRecord | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM certificate_distribution_events WHERE distribution_event_id = ? LIMIT 1")
      .get(id) as CertificateDistributionEventRow | undefined;
    return row ? mapCertificateDistributionEventRowToRecord(row) : undefined;
  }

  private getMutationReplayRecord<TRecord>(operationKey: string): TRecord | undefined {
    const row = this.getDatabase().prepare("SELECT * FROM certificate_mutation_replays WHERE operation_key = ? LIMIT 1")
      .get(operationKey) as CertificateMutationReplayRow | undefined;
    return row ? parseCertificateMutationReplayRecord<TRecord>(row) : undefined;
  }

  private persistMutationReplayRecord(operationKey: string, mutationKind: MutationKind, record: unknown): void {
    this.getDatabase().prepare(
      "INSERT INTO certificate_mutation_replays (operation_key, mutation_kind, record_snapshot_json, created_at) VALUES (?, ?, ?, ?)",
    ).run(operationKey, mutationKind, JSON.stringify(record), new Date().toISOString());
  }

  private upsertStatusEvent(record: CertificateStatusHistoryPersistenceRecord): void {
    this.getDatabase().prepare(`
      INSERT INTO certificate_status_history (
        status_event_id, certificate_authority_id, serial_number,
        previous_status, current_status, occurred_at, occurred_by, reason, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(status_event_id) DO UPDATE SET
        certificate_authority_id = excluded.certificate_authority_id,
        serial_number = excluded.serial_number,
        previous_status = excluded.previous_status,
        current_status = excluded.current_status,
        occurred_at = excluded.occurred_at,
        occurred_by = excluded.occurred_by,
        reason = excluded.reason,
        note = excluded.note
    `).run(...mapCertificateStatusHistoryRecordToRowValues(record));
  }

  private upsertRevocationRecord(record: CertificateRevocationHistoryPersistenceRecord): void {
    this.getDatabase().prepare(`
      INSERT INTO certificate_revocations (
        revocation_id, certificate_authority_id, serial_number,
        reason, revoked_at, revoked_by_actor_id, note,
        created_at, created_by, last_modified_at, last_modified_by, revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(revocation_id) DO UPDATE SET
        certificate_authority_id = excluded.certificate_authority_id,
        serial_number = excluded.serial_number,
        reason = excluded.reason,
        revoked_at = excluded.revoked_at,
        revoked_by_actor_id = excluded.revoked_by_actor_id,
        note = excluded.note,
        created_at = excluded.created_at,
        created_by = excluded.created_by,
        last_modified_at = excluded.last_modified_at,
        last_modified_by = excluded.last_modified_by,
        revision = excluded.revision
      WHERE excluded.revision > certificate_revocations.revision
    `).run(...mapCertificateRevocationRecordToRowValues(record));
  }

  private persistWithReplay<TRecord>(
    mutationKind: MutationKind,
    operationKeyInput: string,
    writer: () => TRecord,
  ): CertificateAuthorityPersistenceMutationResult<TRecord> {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(operationKeyInput);
    const replay = this.getMutationReplayRecord<TRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let record: TRecord | undefined;
    this.getDatabase().transaction(() => {
      record = writer();
      this.persistMutationReplayRecord(operationKey, mutationKind, record);
    })();

    return Object.freeze({
      record: record as TRecord,
      changed: true,
      wasReplay: false,
    });
  }

  private toPagingClause(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
    const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : undefined;

    if (normalizedLimit !== undefined && normalizedOffset !== undefined) {
      return { sql: "LIMIT ? OFFSET ?", params: Object.freeze([normalizedLimit, normalizedOffset]) };
    }
    if (normalizedLimit !== undefined) {
      return { sql: "LIMIT ?", params: Object.freeze([normalizedLimit]) };
    }
    if (normalizedOffset !== undefined) {
      return { sql: "LIMIT -1 OFFSET ?", params: Object.freeze([normalizedOffset]) };
    }

    return { sql: "", params: Object.freeze([]) };
  }

  private resolveMutationTimestamp(candidate?: string): string {
    const normalized = candidate?.trim();
    return normalized && normalized.length > 0 ? normalized : new Date().toISOString();
  }

  private toSerial(value: string | undefined): string | undefined {
    const normalized = value?.trim().toUpperCase();
    return normalized && normalized.length > 0 ? normalized : undefined;
  }

  private assertExpectedRevision(
    expectedRevision: number | undefined,
    persistedRevision: number | undefined,
    entityName: string,
  ): void {
    if (typeof expectedRevision !== "number") {
      return;
    }

    const currentRevision = persistedRevision ?? 0;
    if (expectedRevision !== currentRevision) {
      throw new Error(`${entityName} expectedRevision '${expectedRevision}' did not match persisted revision '${currentRevision}'.`);
    }
  }
}

