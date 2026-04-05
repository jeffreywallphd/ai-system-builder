import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CertificateAuthorityStatuses, CertificateRevocationReasons, CertificateStatuses, CertificateSubjectReferenceKinds, CertificateUsageKinds } from "../../../../domain/security/CertificateAuthorityDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteCertificateAuthorityPersistenceAdapter } from "../SqliteCertificateAuthorityPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteCertificateAuthorityPersistenceAdapter", () => {
  it("applies migrations and creates certificate authority persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-ca-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "ca.sqlite");

    const adapter = new SqliteCertificateAuthorityPersistenceAdapter(databasePath);
    await adapter.saveCertificateAuthority({
      record: {
        certificateAuthorityId: "ca:internal:root:v1",
        displayName: "AI Loom Internal Root",
        status: CertificateAuthorityStatuses.active,
        subject: {
          commonName: "AI Loom Internal Root CA",
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
        revision: 0,
      },
      mutation: {
        operationKey: "op:ca:init",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM certificate_authority_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'certificate_authorities',
          'issued_certificates',
          'certificate_status_history',
          'certificate_revocations',
          'trust_material_references',
          'certificate_distribution_events',
          'certificate_mutation_replays'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "certificate_authorities",
      "certificate_distribution_events",
      "certificate_mutation_replays",
      "certificate_revocations",
      "certificate_status_history",
      "issued_certificates",
      "trust_material_references",
    ]);

    database.close();
  });

  it("supports issuance, revocation tracking, and distribution-event persistence", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-ca-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteCertificateAuthorityPersistenceAdapter(path.join(root, "ca.sqlite"));

    await adapter.saveTrustMaterial({
      record: {
        materialRef: "trust:bundle:root:v1",
        kind: "certificate-chain-pem",
        storageLocator: "vault://ca/trust/bundle/root-v1",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op:trust:save:v1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const caResult = await adapter.saveCertificateAuthority({
      record: {
        certificateAuthorityId: "ca:internal:root:v1",
        displayName: "AI Loom Internal Root",
        status: CertificateAuthorityStatuses.active,
        subject: {
          commonName: "AI Loom Internal Root CA",
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
        revision: 0,
      },
      mutation: {
        operationKey: "op:ca:save:v1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const issued = await adapter.saveIssuedCertificate({
      record: {
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
          workspaceId: "workspace:alpha",
        },
        usages: [CertificateUsageKinds.serverAuth, CertificateUsageKinds.clientAuth],
        validity: {
          notBefore: "2026-04-05T12:00:00.000Z",
          notAfter: "2027-04-05T12:00:00.000Z",
        },
        issuedAt: "2026-04-05T12:00:00.000Z",
        certificateMaterialRef: "trust:cert:node-01:v1",
        certificateChainMaterialRef: "trust:chain:root:v1",
        trustMaterialRef: "trust:bundle:root:v1",
        publicKeyAlgorithm: "rsa-4096",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op:cert:issue:v1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const revoked = await adapter.revokeIssuedCertificate({
      serialNumber: issued.record.serialNumber,
      revocation: {
        reason: CertificateRevocationReasons.policyViolation,
        revokedAt: "2026-06-01T00:00:00.000Z",
        revokedByActorId: "user:security-admin",
      },
      mutation: {
        operationKey: "op:cert:revoke:v1",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2026-06-01T00:00:00.000Z",
        },
      },
    });

    await adapter.saveCertificateDistributionEvent({
      record: {
        distributionEventId: "distribution:node:01:v1",
        materialRef: "trust:bundle:root:v1",
        certificateAuthorityId: "ca:internal:root:v1",
        serialNumber: "C0FFEE",
        targetKind: "node",
        targetReferenceId: "node:01",
        workspaceId: "workspace:alpha",
        transport: "node-trust-bundle-sync",
        status: "published",
        occurredAt: "2026-06-01T00:01:00.000Z",
        occurredBy: "user:security-admin",
        createdAt: "2026-06-01T00:01:00.000Z",
        createdBy: "user:security-admin",
        lastModifiedAt: "2026-06-01T00:01:00.000Z",
        lastModifiedBy: "user:security-admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op:distribution:save:v1",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2026-06-01T00:01:00.000Z",
        },
      },
    });

    const activeRoot = await adapter.findActiveCertificateAuthority("2026-07-01T00:00:00.000Z");
    const statusHistory = await adapter.listCertificateStatusHistory({ serialNumber: "c0ffee" });
    const revocations = await adapter.listCertificateRevocations({ serialNumber: "C0FFEE" });
    const distributionEvents = await adapter.listCertificateDistributionEvents({ targetKinds: ["node"] });

    expect(caResult.record.revision).toBe(1);
    expect(activeRoot?.certificateAuthorityId).toBe("ca:internal:root:v1");
    expect(revoked.record.status).toBe(CertificateStatuses.revoked);
    expect(statusHistory.length).toBeGreaterThanOrEqual(2);
    expect(revocations).toHaveLength(1);
    expect(revocations[0]?.reason).toBe(CertificateRevocationReasons.policyViolation);
    expect(distributionEvents).toHaveLength(1);

    adapter.dispose();
  });
});
