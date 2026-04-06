export const PlatformPersistenceDomains = Object.freeze({
  identity: "identity",
  workspace: "workspace",
  authorization: "authorization",
  nodes: "nodes",
  storage: "storage",
  assets: "assets",
  runs: "runs",
  security: "security",
  secrets: "secrets",
  sessions: "sessions",
  audit: "audit",
});

export type PlatformPersistenceDomain =
  typeof PlatformPersistenceDomains[keyof typeof PlatformPersistenceDomains];

export const PlatformPersistenceTenancyScopes = Object.freeze({
  platform: "platform",
  workspace: "workspace",
  user: "user",
  node: "node",
  mixed: "mixed",
});

export type PlatformPersistenceTenancyScope =
  typeof PlatformPersistenceTenancyScopes[keyof typeof PlatformPersistenceTenancyScopes];

export const PlatformPersistenceAuthorityScopes = Object.freeze({
  authoritativeServer: "authoritative-server",
});

export type PlatformPersistenceAuthorityScope =
  typeof PlatformPersistenceAuthorityScopes[keyof typeof PlatformPersistenceAuthorityScopes];

export const PlatformPersistenceModelKinds = Object.freeze({
  authoritativeWriteModel: "authoritative-write-model",
  readModelProjection: "read-model-projection",
});

export type PlatformPersistenceModelKind =
  typeof PlatformPersistenceModelKinds[keyof typeof PlatformPersistenceModelKinds];

export interface PlatformPersistenceReadModelBoundary {
  readonly modelId: string;
  readonly description: string;
  readonly ownerDomain: PlatformPersistenceDomain;
}

export interface PlatformAggregatePersistenceBoundary {
  readonly domain: PlatformPersistenceDomain;
  readonly aggregateId: string;
  readonly authoritativeModelKind: typeof PlatformPersistenceModelKinds.authoritativeWriteModel;
  readonly authorityScope: PlatformPersistenceAuthorityScope;
  readonly tenancyScope: PlatformPersistenceTenancyScope;
  readonly repositoryTargets: ReadonlyArray<string>;
  readonly readModels: ReadonlyArray<PlatformPersistenceReadModelBoundary>;
  readonly ownershipBoundary: string;
  readonly relationshipBoundaries: ReadonlyArray<string>;
}

export const CorePlatformAggregatePersistenceBoundaries: ReadonlyArray<PlatformAggregatePersistenceBoundary> = Object.freeze([
  Object.freeze({
    domain: PlatformPersistenceDomains.identity,
    aggregateId: "identity-user-and-provider-link",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.user,
    repositoryTargets: Object.freeze([
      "application/identity/ports/IIdentityPersistenceRepository",
      "application/identity/ports/IIdentityLookupRepository",
      "application/identity/ports/ICredentialMaterialRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "identity-account-admin-summary",
        description: "Account status and provider-link summaries for administration views.",
        ownerDomain: PlatformPersistenceDomains.identity,
      }),
    ]),
    ownershipBoundary:
      "Identity lifecycle and provider-link truth is owned by identity repositories; external domains consume identity ids and status via reads.",
    relationshipBoundaries: Object.freeze([
      "Workspace membership references identity ids but does not mutate identity aggregates.",
      "Authorization actor membership reads identity status but does not own credential/session state.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.workspace,
    aggregateId: "workspace-tenancy-and-membership",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.workspace,
    repositoryTargets: Object.freeze([
      "src/application/workspaces/ports/IWorkspaceRepository",
      "src/application/workspaces/ports/IWorkspaceMembershipRepository",
      "src/application/workspaces/ports/IWorkspaceRoleAssignmentRepository",
      "src/application/workspaces/ports/IWorkspaceInvitationRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "workspace-administration-view",
        description: "Workspace, membership, invitation, and role projection for admin surfaces.",
        ownerDomain: PlatformPersistenceDomains.workspace,
      }),
    ]),
    ownershipBoundary:
      "Workspace lifecycle, membership, invitations, and role assignments are workspace-owned authoritative records.",
    relationshipBoundaries: Object.freeze([
      "Authorization consumes workspace context for scoped policy decisions.",
      "Storage and assets depend on workspace ownership metadata without owning workspace lifecycle.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.authorization,
    aggregateId: "authorization-policy-and-grants",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.mixed,
    repositoryTargets: Object.freeze([
      "src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository",
      "src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository",
      "src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "authorization-effective-access",
        description: "Derived actor/resource permission evaluation projection.",
        ownerDomain: PlatformPersistenceDomains.authorization,
      }),
    ]),
    ownershipBoundary:
      "Authorization owns role assignments, sharing grants, and resource policy metadata as authoritative policy inputs.",
    relationshipBoundaries: Object.freeze([
      "Workspace roles provide actor membership context but authorization owns permission resolution semantics.",
      "Asset/storage/workflow resources expose policy metadata; authorization owns policy decision logic.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.nodes,
    aggregateId: "node-trust-identity-and-enrollment",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.node,
    repositoryTargets: Object.freeze([
      "src/application/nodes/ports/INodeTrustIdentityPersistenceRepository",
      "src/application/nodes/ports/INodeEnrollmentRequestPersistenceRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "trusted-node-inventory",
        description: "Operational inventory projection for trusted and pending nodes.",
        ownerDomain: PlatformPersistenceDomains.nodes,
      }),
    ]),
    ownershipBoundary:
      "Node enrollment and trust lifecycle remain authoritative in node-trust persistence, with certificate refs stored as linked metadata.",
    relationshipBoundaries: Object.freeze([
      "Internal CA issues and revokes certificate material but does not own node trust state transitions.",
      "Transport security consumes node identity trust as an input for connection-policy decisions.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.storage,
    aggregateId: "storage-instance-policy-and-lifecycle",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.workspace,
    repositoryTargets: Object.freeze([
      "src/application/storage/ports/IStorageInstanceRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "storage-access-summary",
        description: "Permission-aware storage action summary projection.",
        ownerDomain: PlatformPersistenceDomains.storage,
      }),
    ]),
    ownershipBoundary:
      "Storage instance identity, policy, lifecycle, and backend binding metadata are authoritative in storage persistence.",
    relationshipBoundaries: Object.freeze([
      "Assets and runs reference logical storage targets; they do not own storage instance lifecycle.",
      "Workspace policy contributes tenancy constraints for storage ownership.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.assets,
    aggregateId: "logical-asset-and-upload-session",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.workspace,
    repositoryTargets: Object.freeze([
      "src/application/assets/ports/IAssetRepository",
      "src/application/assets/ports/IAssetUploadSessionRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "asset-detail-and-discovery",
        description: "Asset summary/detail projection for browser and administration surfaces.",
        ownerDomain: PlatformPersistenceDomains.assets,
      }),
    ]),
    ownershipBoundary:
      "Asset metadata, ownership lineage, lifecycle status, and upload-session state are asset-domain authoritative writes.",
    relationshipBoundaries: Object.freeze([
      "Storage adapters own blob/object mechanics while asset domain owns logical asset identity and lifecycle.",
      "Authorization visibility and sharing metadata are consumed for access decisions but remain authorization-owned.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.runs,
    aggregateId: "platform-run-ledger",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.mixed,
    repositoryTargets: Object.freeze([
      "src/application/common/ports/PlatformPersistenceBoundaryPorts#IPlatformRunRecordRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "run-observability-summary",
        description: "Operational run list/detail projection for workflow, agent, and system execution.",
        ownerDomain: PlatformPersistenceDomains.runs,
      }),
    ]),
    ownershipBoundary:
      "Run lifecycle and terminal status truth are authoritative in the run ledger and are never inferred from UI-local state.",
    relationshipBoundaries: Object.freeze([
      "Workflow/agent definitions remain separate authored aggregates referenced by run records.",
      "Audit and observability consume run events but do not own run status transitions.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.security,
    aggregateId: "certificate-authority-and-issued-certificate",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.platform,
    repositoryTargets: Object.freeze([
      "src/application/security/ports/ICertificateAuthorityRootPersistenceRepository",
      "src/application/security/ports/IIssuedCertificatePersistenceRepository",
      "src/application/security/ports/ITrustMaterialReferencePersistenceRepository",
      "src/application/security/ports/ICertificateLifecycleEventPersistenceRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "certificate-status-introspection",
        description: "Certificate lifecycle and distribution status projection.",
        ownerDomain: PlatformPersistenceDomains.security,
      }),
    ]),
    ownershipBoundary:
      "CA roots, issued certificate metadata, trust-material references, and certificate lifecycle history are security-owned authoritative records.",
    relationshipBoundaries: Object.freeze([
      "Node trust stores certificate references but does not own CA issuance lifecycle.",
      "Transport policy checks consume trust records without mutating certificate-authority aggregates.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.secrets,
    aggregateId: "secret-record-and-version-lineage",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.mixed,
    repositoryTargets: Object.freeze([
      "src/application/security/ports/SecretServicePorts#ISecretRecordPersistenceRepository",
      "src/application/security/ports/SecretServicePorts#ISecretReEncryptionOperationRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "secret-metadata-index",
        description: "Redacted metadata-only secret listing and lookup projection.",
        ownerDomain: PlatformPersistenceDomains.secrets,
      }),
    ]),
    ownershipBoundary:
      "Secret metadata, version lineage, and encrypted material references are secrets-domain authoritative; plaintext is never persisted.",
    relationshipBoundaries: Object.freeze([
      "Runtime consumers retrieve secrets through policy-checked application services, not direct repository access.",
      "Key-encryption context is security-managed metadata and does not change secret ownership scope.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.sessions,
    aggregateId: "identity-authenticated-session",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.user,
    repositoryTargets: Object.freeze([
      "application/identity/ports/IIdentitySessionRepository",
      "application/identity/ports/IIdentitySessionTokenMaterialRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "authenticated-session-resolution",
        description: "Session validation projection used by authenticated transport guards.",
        ownerDomain: PlatformPersistenceDomains.sessions,
      }),
    ]),
    ownershipBoundary:
      "Session lifecycle status, revocation, expiry, and token-material validity remain identity-session authoritative writes.",
    relationshipBoundaries: Object.freeze([
      "Trusted-device posture can influence validation decisions but does not own session lifecycle rows.",
      "Transport guards consume resolved session read models and do not mutate session records directly.",
    ]),
  }),
  Object.freeze({
    domain: PlatformPersistenceDomains.audit,
    aggregateId: "platform-audit-event-ledger",
    authoritativeModelKind: PlatformPersistenceModelKinds.authoritativeWriteModel,
    authorityScope: PlatformPersistenceAuthorityScopes.authoritativeServer,
    tenancyScope: PlatformPersistenceTenancyScopes.mixed,
    repositoryTargets: Object.freeze([
      "src/application/common/ports/PlatformPersistenceBoundaryPorts#IPlatformAuditEventRepository",
    ]),
    readModels: Object.freeze([
      Object.freeze({
        modelId: "audit-review-query",
        description: "Filtered audit event review projection for security and administration workflows.",
        ownerDomain: PlatformPersistenceDomains.audit,
      }),
    ]),
    ownershipBoundary:
      "Audit event append history is authoritative and append-only, with redacted payload expectations enforced before persistence.",
    relationshipBoundaries: Object.freeze([
      "Domain services emit auditable events but do not define audit storage schema details.",
      "Audit query projections support review/reporting and are derived from append-only event truth.",
    ]),
  }),
]);
