import fs from "node:fs";
import path from "node:path";
import type { INodeEnrollmentRequestPersistenceRepository } from "../../../application/nodes/ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../../../application/nodes/ports/INodeTrustIdentityPersistenceRepository";
import { NodeEnrollmentRequestStatuses, NodeTrustStates } from "../../../domain/nodes/NodeTrustDomain";
import {
  NodeTrustPersistenceQueryPresets,
  normalizeNodeTrustMutationOperationKey,
  type NodeEnrollmentRequestPersistenceLookupQuery,
  type NodeEnrollmentRequestPersistenceRecord,
  type NodeIdentityPersistenceLookupQuery,
  type NodeIdentityPersistenceRecord,
  type NodeTrustPersistenceMutationResult,
  type RecordNodeLastSeenPersistenceRecordInput,
  type RegisterNodeIdentityPersistenceRecordInput,
  type RevokeNodeIdentityPersistenceRecordInput,
  type SaveNodeEnrollmentRequestPersistenceRecordInput,
  type TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  type UpdateNodeApprovalPersistenceRecordInput,
  type UpdateNodeCapabilityProfilePersistenceRecordInput,
  type UpdateNodeCertificateReferencePersistenceRecordInput,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import {
  parseNodeEnrollmentRequestPersistenceRecord,
} from "../../../shared/schemas/nodes/NodeTrustPersistenceSchemaContracts";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapNodeEnrollmentRequestRecordToRowValues,
  mapNodeEnrollmentRequestRowToRecord,
  mapNodeIdentityRecordToRowValues,
  mapNodeIdentityRowToRecord,
  normalizeNodeTrustLookup,
  parseNodeTrustMutationReplayRecord,
  type NodeEnrollmentRequestRow,
  type NodeIdentityRow,
  type NodeTrustMutationReplayRow,
} from "./NodeTrustPersistenceMapper";
import {
  NODE_TRUST_PERSISTENCE_MIGRATIONS,
  NODE_TRUST_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteNodeTrustPersistenceMigrations";

const EnrollmentTerminalStatuses = Object.freeze([
  NodeEnrollmentRequestStatuses.approved,
  NodeEnrollmentRequestStatuses.rejected,
  NodeEnrollmentRequestStatuses.withdrawn,
  NodeEnrollmentRequestStatuses.expired,
]);

export class SqliteNodeTrustPersistenceAdapter
  implements INodeTrustIdentityPersistenceRepository, INodeEnrollmentRequestPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    const normalizedNodeId = normalizeNodeTrustLookup(nodeId);
    if (!normalizedNodeId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        node_id,
        node_type,
        display_name,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        approval_status,
        trust_state,
        certificate_ref,
        certificate_assigned_at,
        certificate_expires_at,
        certificate_authority_ref,
        certificate_thumbprint,
        deployment_tags_json,
        last_seen_at,
        heartbeat_status,
        last_seen_observed_by,
        revocation_state,
        revocation_reason,
        revocation_revoked_at,
        revocation_revoked_by_user_identity_id,
        revocation_note,
        enrolled_at,
        approved_at,
        revoked_at,
        enrollment_request_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM node_trust_identities
      WHERE node_id = ?
      LIMIT 1
    `).get(normalizedNodeId) as NodeIdentityRow | undefined;

    return row ? mapNodeIdentityRowToRecord(row) : undefined;
  }

  public async listNodes(query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.nodeTypes && query.nodeTypes.length > 0) {
      clauses.push(`n.node_type IN (${query.nodeTypes.map(() => "?").join(", ")})`);
      params.push(...query.nodeTypes);
    }

    if (query.approvalStatuses && query.approvalStatuses.length > 0) {
      clauses.push(`n.approval_status IN (${query.approvalStatuses.map(() => "?").join(", ")})`);
      params.push(...query.approvalStatuses);
    }

    if (query.trustStates && query.trustStates.length > 0) {
      clauses.push(`n.trust_state IN (${query.trustStates.map(() => "?").join(", ")})`);
      params.push(...query.trustStates);
    }

    if (query.revocationStates && query.revocationStates.length > 0) {
      clauses.push(`n.revocation_state IN (${query.revocationStates.map(() => "?").join(", ")})`);
      params.push(...query.revocationStates);
    }

    if (query.capabilityAnyOf && query.capabilityAnyOf.length > 0) {
      clauses.push(`EXISTS (
        SELECT 1
        FROM node_trust_identity_capabilities c
        WHERE c.node_id = n.node_id
          AND c.capability IN (${query.capabilityAnyOf.map(() => "?").join(", ")})
      )`);
      params.push(...query.capabilityAnyOf);
    }

    if (query.deploymentTagAnyOf && query.deploymentTagAnyOf.length > 0) {
      const normalizedTags = query.deploymentTagAnyOf
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
      if (normalizedTags.length > 0) {
        clauses.push(`EXISTS (
          SELECT 1
          FROM node_trust_identity_deployment_tags d
          WHERE d.node_id = n.node_id
            AND d.deployment_tag IN (${normalizedTags.map(() => "?").join(", ")})
        )`);
        params.push(...normalizedTags);
      }
    }

    if (query.certificateAssigned === true) {
      clauses.push("n.certificate_ref IS NOT NULL");
    }

    if (query.certificateAssigned === false) {
      clauses.push("n.certificate_ref IS NULL");
    }

    if (query.activeOnly) {
      clauses.push(`n.trust_state IN (${NodeTrustPersistenceQueryPresets.activeNodeTrustStates.map(() => "?").join(", ")})`);
      params.push(...NodeTrustPersistenceQueryPresets.activeNodeTrustStates);
    }

    if (!(query.includeRevoked ?? false)) {
      clauses.push("n.trust_state != ?");
      params.push(NodeTrustStates.revoked);
    }

    if (query.lastSeenAfter) {
      clauses.push("n.last_seen_at IS NOT NULL");
      clauses.push("n.last_seen_at >= ?");
      params.push(query.lastSeenAfter);
    }

    if (query.lastSeenBefore) {
      clauses.push("(n.last_seen_at IS NULL OR n.last_seen_at <= ?)");
      params.push(query.lastSeenBefore);
    }

    if (query.enrolledAfter) {
      clauses.push("n.enrolled_at >= ?");
      params.push(query.enrolledAfter);
    }

    if (query.enrolledBefore) {
      clauses.push("n.enrolled_at <= ?");
      params.push(query.enrolledBefore);
    }

    const paging = this.toPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        n.node_id,
        n.node_type,
        n.display_name,
        n.capability_enabled_json,
        n.capability_profile_version,
        n.supports_remote_scheduling,
        n.max_concurrent_workloads,
        n.approval_status,
        n.trust_state,
        n.certificate_ref,
        n.certificate_assigned_at,
        n.certificate_expires_at,
        n.certificate_authority_ref,
        n.certificate_thumbprint,
        n.deployment_tags_json,
        n.last_seen_at,
        n.heartbeat_status,
        n.last_seen_observed_by,
        n.revocation_state,
        n.revocation_reason,
        n.revocation_revoked_at,
        n.revocation_revoked_by_user_identity_id,
        n.revocation_note,
        n.enrolled_at,
        n.approved_at,
        n.revoked_at,
        n.enrollment_request_id,
        n.created_at,
        n.created_by,
        n.last_modified_at,
        n.last_modified_by,
        n.revision
      FROM node_trust_identities n
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY n.enrolled_at DESC, n.node_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as NodeIdentityRow[];

    return Object.freeze(rows.map((row) => mapNodeIdentityRowToRecord(row)));
  }

  public async registerNode(
    input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const operationKey = normalizeNodeTrustMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<NodeIdentityPersistenceRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    const candidate = Object.freeze({
      ...input.record,
    });
    const changedAt = this.resolveMutationTimestamp(input.mutation.context.occurredAt);
    let persistedRecord: NodeIdentityPersistenceRecord | undefined;
    let changed = false;

    this.getDatabase().transaction(() => {
      const existing = this.getNodeByIdInternal(candidate.nodeId);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Node");

      persistedRecord = Object.freeze({
        ...candidate,
        createdAt: existing?.createdAt ?? candidate.createdAt,
        createdBy: existing?.createdBy ?? candidate.createdBy,
        lastModifiedAt: changedAt,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });

      changed = !existing || JSON.stringify(existing) !== JSON.stringify(persistedRecord);

      this.executeMutation("upsert node identity", () => this.getDatabase().prepare(`
          INSERT INTO node_trust_identities (
            node_id,
            node_type,
            display_name,
            capability_enabled_json,
            capability_profile_version,
            supports_remote_scheduling,
            max_concurrent_workloads,
            approval_status,
            trust_state,
            certificate_ref,
            certificate_assigned_at,
            certificate_expires_at,
            certificate_authority_ref,
            certificate_thumbprint,
            deployment_tags_json,
            last_seen_at,
            heartbeat_status,
            last_seen_observed_by,
            revocation_state,
            revocation_reason,
            revocation_revoked_at,
            revocation_revoked_by_user_identity_id,
            revocation_note,
            enrolled_at,
            approved_at,
            revoked_at,
            enrollment_request_id,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(node_id) DO UPDATE SET
            node_type = excluded.node_type,
            display_name = excluded.display_name,
            capability_enabled_json = excluded.capability_enabled_json,
            capability_profile_version = excluded.capability_profile_version,
            supports_remote_scheduling = excluded.supports_remote_scheduling,
            max_concurrent_workloads = excluded.max_concurrent_workloads,
            approval_status = excluded.approval_status,
            trust_state = excluded.trust_state,
            certificate_ref = excluded.certificate_ref,
            certificate_assigned_at = excluded.certificate_assigned_at,
            certificate_expires_at = excluded.certificate_expires_at,
            certificate_authority_ref = excluded.certificate_authority_ref,
            certificate_thumbprint = excluded.certificate_thumbprint,
            deployment_tags_json = excluded.deployment_tags_json,
            last_seen_at = excluded.last_seen_at,
            heartbeat_status = excluded.heartbeat_status,
            last_seen_observed_by = excluded.last_seen_observed_by,
            revocation_state = excluded.revocation_state,
            revocation_reason = excluded.revocation_reason,
            revocation_revoked_at = excluded.revocation_revoked_at,
            revocation_revoked_by_user_identity_id = excluded.revocation_revoked_by_user_identity_id,
            revocation_note = excluded.revocation_note,
            enrolled_at = excluded.enrolled_at,
            approved_at = excluded.approved_at,
            revoked_at = excluded.revoked_at,
            enrollment_request_id = excluded.enrollment_request_id,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > node_trust_identities.revision
        `).run(...mapNodeIdentityRecordToRowValues(persistedRecord as NodeIdentityPersistenceRecord)));

      this.replaceNodeCapabilityLookupRows(persistedRecord as NodeIdentityPersistenceRecord);
      this.replaceNodeDeploymentTagLookupRows(persistedRecord as NodeIdentityPersistenceRecord);
      this.persistMutationReplayRecord(operationKey, "node-identity", persistedRecord as NodeIdentityPersistenceRecord);
    })();

    return Object.freeze({
      record: persistedRecord as NodeIdentityPersistenceRecord,
      changed,
      wasReplay: false,
    });
  }

  public async updateNodeApproval(
    input: UpdateNodeApprovalPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = await this.findNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Node '${input.nodeId}' was not found.`);
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        approvalStatus: input.approvalStatus,
        approvedAt: input.approvedAt ?? existing.approvedAt,
        trustState: input.trustState ?? existing.trustState,
      },
    });
  }

  public async updateNodeCertificateReference(
    input: UpdateNodeCertificateReferencePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = await this.findNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Node '${input.nodeId}' was not found.`);
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        certificate: input.certificate,
      },
    });
  }

  public async updateNodeCapabilityProfile(
    input: UpdateNodeCapabilityProfilePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = await this.findNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Node '${input.nodeId}' was not found.`);
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        capabilityProfile: input.capabilityProfile,
      },
    });
  }

  public async revokeNode(
    input: RevokeNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = await this.findNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Node '${input.nodeId}' was not found.`);
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        trustState: input.trustState ?? NodeTrustStates.revoked,
        revocation: input.revocation,
        revokedAt: input.revocation.revokedAt ?? existing.revokedAt,
      },
    });
  }

  public async recordNodeLastSeen(
    input: RecordNodeLastSeenPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = await this.findNodeById(input.nodeId);
    if (!existing) {
      throw new Error(`Node '${input.nodeId}' was not found.`);
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        lastSeen: input.lastSeen,
      },
    });
  }

  public async findEnrollmentRequestById(
    requestId: string,
  ): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    const normalizedRequestId = normalizeNodeTrustLookup(requestId);
    if (!normalizedRequestId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        request_id,
        node_id,
        node_type,
        display_name,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        deployment_tags_json,
        certificate_ref,
        requested_at,
        status,
        reviewed_at,
        reviewed_by_user_identity_id,
        decision_note,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM node_enrollment_requests
      WHERE request_id = ?
      LIMIT 1
    `).get(normalizedRequestId) as NodeEnrollmentRequestRow | undefined;

    return row ? mapNodeEnrollmentRequestRowToRecord(row) : undefined;
  }

  public async findPendingEnrollmentRequestByNodeId(
    nodeId: string,
    asOf?: string,
  ): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    const normalizedNodeId = normalizeNodeTrustLookup(nodeId);
    if (!normalizedNodeId) {
      return undefined;
    }

    const statuses = NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses;
    const row = this.getDatabase().prepare(`
      SELECT
        request_id,
        node_id,
        node_type,
        display_name,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        deployment_tags_json,
        certificate_ref,
        requested_at,
        status,
        reviewed_at,
        reviewed_by_user_identity_id,
        decision_note,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM node_enrollment_requests
      WHERE node_id = ?
        AND status IN (${statuses.map(() => "?").join(", ")})
        ${asOf ? "AND requested_at <= ?" : ""}
      ORDER BY requested_at DESC, request_id ASC
      LIMIT 1
    `).get(...(asOf ? [normalizedNodeId, ...statuses, asOf] : [normalizedNodeId, ...statuses])) as
      | NodeEnrollmentRequestRow
      | undefined;

    return row ? mapNodeEnrollmentRequestRowToRecord(row) : undefined;
  }

  public async listEnrollmentRequests(
    query: NodeEnrollmentRequestPersistenceLookupQuery,
  ): Promise<ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const nodeId = normalizeNodeTrustLookup(query.nodeId ?? "");
    if (nodeId) {
      clauses.push("r.node_id = ?");
      params.push(nodeId);
    }

    if (query.nodeTypes && query.nodeTypes.length > 0) {
      clauses.push(`r.node_type IN (${query.nodeTypes.map(() => "?").join(", ")})`);
      params.push(...query.nodeTypes);
    }

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`r.status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    if (!(query.includeTerminal ?? false) && (!query.statuses || query.statuses.length === 0)) {
      clauses.push(`r.status NOT IN (${EnrollmentTerminalStatuses.map(() => "?").join(", ")})`);
      params.push(...EnrollmentTerminalStatuses);
    }

    if (query.requestedAfter) {
      clauses.push("r.requested_at >= ?");
      params.push(query.requestedAfter);
    }

    if (query.requestedBefore) {
      clauses.push("r.requested_at <= ?");
      params.push(query.requestedBefore);
    }

    const reviewedByUserIdentityId = normalizeNodeTrustLookup(query.reviewedByUserIdentityId ?? "");
    if (reviewedByUserIdentityId) {
      clauses.push("r.reviewed_by_user_identity_id = ?");
      params.push(reviewedByUserIdentityId);
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(`
      SELECT
        request_id,
        node_id,
        node_type,
        display_name,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        deployment_tags_json,
        certificate_ref,
        requested_at,
        status,
        reviewed_at,
        reviewed_by_user_identity_id,
        decision_note,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM node_enrollment_requests r
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY r.requested_at DESC, r.request_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as NodeEnrollmentRequestRow[];

    return Object.freeze(rows.map((row) => mapNodeEnrollmentRequestRowToRecord(row)));
  }

  public async saveEnrollmentRequest(
    input: SaveNodeEnrollmentRequestPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    const operationKey = normalizeNodeTrustMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<NodeEnrollmentRequestPersistenceRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: parseNodeEnrollmentRequestPersistenceRecord(replay),
        changed: false,
        wasReplay: true,
      });
    }

    const candidate = parseNodeEnrollmentRequestPersistenceRecord(input.record);
    const changedAt = this.resolveMutationTimestamp(input.mutation.context.occurredAt);
    let persistedRecord: NodeEnrollmentRequestPersistenceRecord | undefined;
    let changed = false;

    this.getDatabase().transaction(() => {
      const existing = this.getEnrollmentRequestByIdInternal(candidate.requestId);
      this.assertExpectedRevision(input.mutation.expectedRevision, existing?.revision, "Enrollment request");

      persistedRecord = parseNodeEnrollmentRequestPersistenceRecord({
        ...candidate,
        createdAt: existing?.createdAt ?? candidate.createdAt,
        createdBy: existing?.createdBy ?? candidate.createdBy,
        lastModifiedAt: changedAt,
        lastModifiedBy: input.mutation.context.actorUserIdentityId,
        revision: existing ? existing.revision + 1 : 1,
      });

      changed = !existing || JSON.stringify(existing) !== JSON.stringify(persistedRecord);

      this.executeMutation("upsert enrollment request", () => this.getDatabase().prepare(`
          INSERT INTO node_enrollment_requests (
            request_id,
            node_id,
            node_type,
            display_name,
            capability_enabled_json,
            capability_profile_version,
            supports_remote_scheduling,
            max_concurrent_workloads,
            deployment_tags_json,
            certificate_ref,
            requested_at,
            status,
            reviewed_at,
            reviewed_by_user_identity_id,
            decision_note,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(request_id) DO UPDATE SET
            node_id = excluded.node_id,
            node_type = excluded.node_type,
            display_name = excluded.display_name,
            capability_enabled_json = excluded.capability_enabled_json,
            capability_profile_version = excluded.capability_profile_version,
            supports_remote_scheduling = excluded.supports_remote_scheduling,
            max_concurrent_workloads = excluded.max_concurrent_workloads,
            deployment_tags_json = excluded.deployment_tags_json,
            certificate_ref = excluded.certificate_ref,
            requested_at = excluded.requested_at,
            status = excluded.status,
            reviewed_at = excluded.reviewed_at,
            reviewed_by_user_identity_id = excluded.reviewed_by_user_identity_id,
            decision_note = excluded.decision_note,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > node_enrollment_requests.revision
        `).run(...mapNodeEnrollmentRequestRecordToRowValues(
          persistedRecord as NodeEnrollmentRequestPersistenceRecord,
        )));

      this.persistMutationReplayRecord(
        operationKey,
        "enrollment-request",
        persistedRecord as NodeEnrollmentRequestPersistenceRecord,
      );
    })();

    return Object.freeze({
      record: persistedRecord as NodeEnrollmentRequestPersistenceRecord,
      changed,
      wasReplay: false,
    });
  }

  public async transitionEnrollmentRequestStatus(
    input: TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    const existing = await this.findEnrollmentRequestById(input.requestId);
    if (!existing) {
      throw new Error(`Enrollment request '${input.requestId}' was not found.`);
    }

    const reviewedAt = input.reviewedAt
      ?? (
        input.toStatus === NodeEnrollmentRequestStatuses.approved
        || input.toStatus === NodeEnrollmentRequestStatuses.rejected
      ? input.mutation.context.occurredAt ?? existing.lastModifiedAt
      : existing.reviewedAt
      );

    return this.saveEnrollmentRequest({
      mutation: input.mutation,
      record: {
        ...existing,
        status: input.toStatus,
        reviewedAt,
        reviewedByUserIdentityId: input.reviewedByUserIdentityId ?? existing.reviewedByUserIdentityId,
        decisionNote: input.decisionNote ?? existing.decisionNote,
      },
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
    if (currentVersion > NODE_TRUST_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Node trust schema version ${currentVersion} is newer than supported version ${NODE_TRUST_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of NODE_TRUST_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO node_trust_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS node_trust_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM node_trust_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private getNodeByIdInternal(nodeId: string): NodeIdentityPersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        node_id,
        node_type,
        display_name,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        approval_status,
        trust_state,
        certificate_ref,
        certificate_assigned_at,
        certificate_expires_at,
        certificate_authority_ref,
        certificate_thumbprint,
        deployment_tags_json,
        last_seen_at,
        heartbeat_status,
        last_seen_observed_by,
        revocation_state,
        revocation_reason,
        revocation_revoked_at,
        revocation_revoked_by_user_identity_id,
        revocation_note,
        enrolled_at,
        approved_at,
        revoked_at,
        enrollment_request_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM node_trust_identities
      WHERE node_id = ?
      LIMIT 1
    `).get(nodeId) as NodeIdentityRow | undefined;

    return row ? mapNodeIdentityRowToRecord(row) : undefined;
  }

  private getEnrollmentRequestByIdInternal(requestId: string): NodeEnrollmentRequestPersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        request_id,
        node_id,
        node_type,
        display_name,
        capability_enabled_json,
        capability_profile_version,
        supports_remote_scheduling,
        max_concurrent_workloads,
        deployment_tags_json,
        certificate_ref,
        requested_at,
        status,
        reviewed_at,
        reviewed_by_user_identity_id,
        decision_note,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM node_enrollment_requests
      WHERE request_id = ?
      LIMIT 1
    `).get(requestId) as NodeEnrollmentRequestRow | undefined;

    return row ? mapNodeEnrollmentRequestRowToRecord(row) : undefined;
  }

  private getMutationReplayRecord<TRecord>(operationKey: string): TRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        operation_key,
        mutation_kind,
        record_snapshot_json,
        created_at
      FROM node_trust_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as NodeTrustMutationReplayRow | undefined;

    return row ? parseNodeTrustMutationReplayRecord<TRecord>(row) : undefined;
  }

  private persistMutationReplayRecord<TRecord>(
    operationKey: string,
    mutationKind: "node-identity" | "enrollment-request",
    record: TRecord,
  ): void {
    this.executeMutation("persist mutation replay", () => this.getDatabase().prepare(`
        INSERT INTO node_trust_mutation_replays (
          operation_key,
          mutation_kind,
          record_snapshot_json,
          created_at
        ) VALUES (?, ?, ?, ?)
      `).run(operationKey, mutationKind, JSON.stringify(record), new Date().toISOString()));
  }

  private replaceNodeCapabilityLookupRows(record: NodeIdentityPersistenceRecord): void {
    this.executeMutation("replace node capability lookup rows", () => this.getDatabase().prepare(
      "DELETE FROM node_trust_identity_capabilities WHERE node_id = ?",
    ).run(record.nodeId));

    const insert = this.getDatabase().prepare(`
      INSERT INTO node_trust_identity_capabilities (node_id, capability)
      VALUES (?, ?)
    `);
    for (const capability of record.capabilityProfile.enabledCapabilities) {
      insert.run(record.nodeId, capability);
    }
  }

  private replaceNodeDeploymentTagLookupRows(record: NodeIdentityPersistenceRecord): void {
    this.executeMutation("replace node deployment tag lookup rows", () => this.getDatabase().prepare(
      "DELETE FROM node_trust_identity_deployment_tags WHERE node_id = ?",
    ).run(record.nodeId));

    const insert = this.getDatabase().prepare(`
      INSERT INTO node_trust_identity_deployment_tags (node_id, deployment_tag)
      VALUES (?, ?)
    `);
    for (const tag of record.deploymentTags) {
      insert.run(record.nodeId, tag.trim().toLowerCase());
    }
  }

  private toPagingClause(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
    const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : undefined;

    if (normalizedLimit !== undefined && normalizedOffset !== undefined) {
      return {
        sql: "LIMIT ? OFFSET ?",
        params: Object.freeze([normalizedLimit, normalizedOffset]),
      };
    }

    if (normalizedLimit !== undefined) {
      return {
        sql: "LIMIT ?",
        params: Object.freeze([normalizedLimit]),
      };
    }

    if (normalizedOffset !== undefined) {
      return {
        sql: "LIMIT -1 OFFSET ?",
        params: Object.freeze([normalizedOffset]),
      };
    }

    return {
      sql: "",
      params: Object.freeze([]),
    };
  }

  private resolveMutationTimestamp(candidate?: string): string {
    const normalizedCandidate = candidate?.trim();
    return normalizedCandidate && normalizedCandidate.length > 0
      ? normalizedCandidate
      : new Date().toISOString();
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
      throw new Error(
        `${entityName} expectedRevision '${expectedRevision}' did not match persisted revision '${currentRevision}'.`,
      );
    }
  }

  private executeMutation(operation: string, mutation: () => { readonly changes: number }): { readonly changes: number } {
    try {
      return mutation();
    } catch (error) {
      throw this.toPersistenceError(operation, error);
    }
  }

  private toPersistenceError(operation: string, error: unknown): Error {
    const details = error instanceof Error ? error.message : String(error);
    return new Error(`Node trust persistence failed to ${operation}: ${details}`);
  }
}
