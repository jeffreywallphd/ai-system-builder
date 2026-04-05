import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "../../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateAuthorityRootPersistenceRecordSchema,
  CertificateAuthoritySchemaValidationError,
  parseCertificateMetadataListView,
  parseCertificateAuthorityStatusIntrospectionView,
  parseCertificateDistributionEventPersistenceRecord,
  parseIssuedCertificateMetadataView,
  parseCertificateRevocationHistoryPersistenceRecord,
  parseCertificateStatusHistoryPersistenceRecord,
  IssuedCertificatePersistenceRecordSchema,
  parseCertificateAuthorityRootPersistenceRecord,
  parseIssuedCertificatePersistenceRecord,
  parseTrustMaterialReferencePersistenceRecord,
} from "../CertificateAuthoritySchemaContracts";

describe("CertificateAuthoritySchemaContracts", () => {
  it("accepts canonical certificate authority root records", () => {
    const parsed = CertificateAuthorityRootPersistenceRecordSchema.parse({
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      status: CertificateAuthorityStatuses.active,
      subject: {
        commonName: "AI Loom Internal Root CA",
        organization: "AI Loom",
        country: "US",
        dnsNames: ["ca.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      serialNumber: "A1B2C3",
      validity: {
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2036-04-05T12:00:00.000Z",
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      rootCertificateMaterialRef: "trust:ca-root-cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca-root-key:v1",
      rotationPolicy: {
        profileId: "rotation:default",
        autoRotateEnabled: true,
        rotateBeforeExpiryDays: 90,
        overlapDays: 30,
        maxLifetimeDays: 3650,
      },
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    });

    expect(parsed.status).toBe(CertificateAuthorityStatuses.active);
    expect(parsed.rotationPolicy.autoRotateEnabled).toBeTrue();
  });

  it("rejects retired roots without retiredAt", () => {
    expect(() => parseCertificateAuthorityRootPersistenceRecord({
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      status: CertificateAuthorityStatuses.retired,
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: [],
        ipAddresses: [],
        uriSanEntries: [],
      },
      serialNumber: "A1B2C3",
      validity: {
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2036-04-05T12:00:00.000Z",
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      rootCertificateMaterialRef: "trust:ca-root-cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca-root-key:v1",
      rotationPolicy: {
        profileId: "rotation:default",
        autoRotateEnabled: true,
        rotateBeforeExpiryDays: 90,
        overlapDays: 30,
        maxLifetimeDays: 3650,
      },
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    })).toThrow(CertificateAuthoritySchemaValidationError);
  });

  it("accepts issued certificate records", () => {
    const parsed = IssuedCertificatePersistenceRecordSchema.parse({
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "C0FFEE",
      status: CertificateStatuses.issued,
      subject: {
        commonName: "node-01.ai-loom.internal",
        dnsNames: ["node-01.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.node,
        referenceId: "node:01",
      },
      usages: [
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
      ],
      validity: {
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2027-04-05T12:00:00.000Z",
      },
      issuedAt: "2026-04-05T12:00:00.000Z",
      certificateMaterialRef: "trust:cert:node-01:v1",
      publicKeyAlgorithm: "rsa-4096",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    });

    expect(parsed.subjectReference.kind).toBe(CertificateSubjectReferenceKinds.node);
    expect(parsed.usages).toContain(CertificateUsageKinds.serverAuth);
  });

  it("rejects revoked certificates without revocation metadata", () => {
    expect(() => parseIssuedCertificatePersistenceRecord({
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "C0FFEE",
      status: CertificateStatuses.revoked,
      subject: {
        commonName: "node-01.ai-loom.internal",
        dnsNames: ["node-01.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.node,
        referenceId: "node:01",
      },
      usages: [CertificateUsageKinds.serverAuth],
      validity: {
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2027-04-05T12:00:00.000Z",
      },
      issuedAt: "2026-04-05T12:00:00.000Z",
      certificateMaterialRef: "trust:cert:node-01:v1",
      publicKeyAlgorithm: "rsa-4096",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    })).toThrow(CertificateAuthoritySchemaValidationError);
  });

  it("parses trust material references", () => {
    const parsed = parseTrustMaterialReferencePersistenceRecord({
      materialRef: "trust:bundle:root:v1",
      kind: "certificate-chain-pem",
      storageLocator: "vault://ca/trust/bundle/root-v1",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    });

    expect(parsed.kind).toBe("certificate-chain-pem");
  });

  it("parses explicit status history and revocation history records", () => {
    const statusEvent = parseCertificateStatusHistoryPersistenceRecord({
      statusEventId: "status:event:1",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "C0FFEE",
      previousStatus: CertificateStatuses.issued,
      currentStatus: CertificateStatuses.revoked,
      occurredAt: "2026-06-01T00:00:00.000Z",
      occurredBy: "user:security-admin",
      reason: "security-policy",
    });

    const revocation = parseCertificateRevocationHistoryPersistenceRecord({
      revocationId: "revocation:1",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "C0FFEE",
      reason: "policy-violation",
      revokedAt: "2026-06-01T00:00:00.000Z",
      revokedByActorId: "user:security-admin",
      createdAt: "2026-06-01T00:00:00.000Z",
      createdBy: "user:security-admin",
      lastModifiedAt: "2026-06-01T00:00:00.000Z",
      lastModifiedBy: "user:security-admin",
      revision: 1,
    });

    expect(statusEvent.currentStatus).toBe(CertificateStatuses.revoked);
    expect(revocation.reason).toBe("policy-violation");
  });

  it("validates failed distribution events include failure reasons", () => {
    expect(() => parseCertificateDistributionEventPersistenceRecord({
      distributionEventId: "distribution:event:1",
      materialRef: "trust:bundle:node-01:v1",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "C0FFEE",
      targetKind: "node",
      targetReferenceId: "node:01",
      transport: "node-trust-bundle-sync",
      status: "failed",
      occurredAt: "2026-06-01T00:00:00.000Z",
      occurredBy: "user:security-admin",
      createdAt: "2026-06-01T00:00:00.000Z",
      createdBy: "user:security-admin",
      lastModifiedAt: "2026-06-01T00:00:00.000Z",
      lastModifiedBy: "user:security-admin",
      revision: 1,
    })).toThrow(CertificateAuthoritySchemaValidationError);
  });

  it("parses sanitized certificate authority introspection views", () => {
    const parsed = parseCertificateAuthorityStatusIntrospectionView({
      asOf: "2026-09-01T00:00:00.000Z",
      initialized: true,
      active: true,
      blocked: false,
      state: "healthy",
      certificateAuthorityId: "ca:internal:root:v1",
      authority: {
        certificateAuthorityId: "ca:internal:root:v1",
        displayName: "AI Loom Internal Root",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastModifiedAt: "2026-01-01T00:00:00.000Z",
        status: "active",
        validityNotBefore: "2026-01-01T00:00:00.000Z",
        validityNotAfter: "2028-01-01T00:00:00.000Z",
        certificateCounts: {
          total: 2,
          issued: 1,
          revoked: 1,
          expired: 0,
          superseded: 0,
          activeAtAsOf: 1,
        },
        lastIssuedAt: "2026-08-20T00:00:00.000Z",
        rotationCheckpoint: {
          recommendedRotationAt: "2027-10-03T00:00:00.000Z",
          configuredNextRotationDueAt: "2027-10-03T00:00:00.000Z",
          daysUntilRecommendedRotation: 397,
          isDue: false,
          isOverdue: false,
        },
      },
      diagnostics: [
        {
          code: "bootstrap-config-ready",
          severity: "info",
          message: "Bootstrap configuration is aligned with persistence.",
        },
      ],
      healthFlags: {
        startupHealthy: true,
        configurationBlocked: false,
        authorityActive: true,
        rotationDueSoon: false,
        rotationOverdue: false,
        hasRevokedCertificates: true,
        hasExpiringCertificates: false,
        hasDistributionFailures: false,
      },
    });

    expect(parsed.state).toBe("healthy");
    expect(parsed.authority?.certificateCounts.total).toBe(2);
  });

  it("parses sanitized issued certificate metadata views and list responses", () => {
    const item = parseIssuedCertificateMetadataView({
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "AA11",
      status: "issued",
      trust: {
        status: "active",
        active: true,
        revoked: false,
        expired: false,
        usable: true,
        checkedAt: "2026-08-20T00:00:00.000Z",
      },
      subject: {
        commonName: "node-01.ai-loom.internal",
        dnsNames: ["node-01.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      subjectReference: {
        kind: "node",
        referenceId: "node:01",
        workspaceId: "workspace:alpha",
      },
      usages: ["server-auth"],
      validity: {
        notBefore: "2026-01-01T00:00:00.000Z",
        notAfter: "2027-01-01T00:00:00.000Z",
      },
      issuedAt: "2026-01-01T00:00:00.000Z",
      publicKeyAlgorithm: "rsa-4096",
      publicKeyFingerprintSha256: "sha256:abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-01-01T00:00:00.000Z",
      lastModifiedBy: "user:admin",
    });

    const list = parseCertificateMetadataListView({
      asOf: "2026-08-20T00:00:00.000Z",
      items: [item],
      pagination: {
        limit: 25,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(item.trust.status).toBe("active");
    expect(list.pagination.returned).toBe(1);
  });
});
