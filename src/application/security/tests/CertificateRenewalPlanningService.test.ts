import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
} from "@domain/security/CertificateAuthorityDomain";
import type {
  CertificateAuthorityRootPersistenceRecord,
  IssuedCertificatePersistenceRecord,
} from "@shared/dto/security/CertificateAuthorityDtos";
import {
  CertificateRenewalPlanningService,
  CertificateRenewalStates,
} from "../use-cases/CertificateRenewalPlanningService";

describe("CertificateRenewalPlanningService", () => {
  it("classifies issued certificates across renewal states", () => {
    const service = new CertificateRenewalPlanningService();
    const certificate = createIssuedCertificate({
      status: CertificateStatuses.issued,
      notAfter: "2026-10-01T00:00:00.000Z",
    });

    const active = service.evaluateIssuedCertificate({
      certificate,
      asOf: "2026-08-01T00:00:00.000Z",
      policy: {
        renewalSoonWindowDays: 30,
        renewalRequiredWindowDays: 7,
      },
    });
    const renewalSoon = service.evaluateIssuedCertificate({
      certificate,
      asOf: "2026-09-05T00:00:00.000Z",
      policy: {
        renewalSoonWindowDays: 30,
        renewalRequiredWindowDays: 7,
      },
    });
    const renewalRequired = service.evaluateIssuedCertificate({
      certificate,
      asOf: "2026-09-25T00:00:00.000Z",
      policy: {
        renewalSoonWindowDays: 30,
        renewalRequiredWindowDays: 7,
      },
    });
    const expired = service.evaluateIssuedCertificate({
      certificate,
      asOf: "2026-10-01T00:00:00.000Z",
      policy: {
        renewalSoonWindowDays: 30,
        renewalRequiredWindowDays: 7,
      },
    });

    expect(active.renewalState).toBe(CertificateRenewalStates.active);
    expect(renewalSoon.renewalState).toBe(CertificateRenewalStates.renewalSoon);
    expect(renewalRequired.renewalState).toBe(CertificateRenewalStates.renewalRequired);
    expect(expired.renewalState).toBe(CertificateRenewalStates.expired);
  });

  it("detects stale issued certificate lifecycle metadata", () => {
    const service = new CertificateRenewalPlanningService();
    const staleIssued = service.evaluateIssuedCertificate({
      certificate: createIssuedCertificate({
        status: CertificateStatuses.issued,
        notAfter: "2026-08-01T00:00:00.000Z",
      }),
      asOf: "2026-08-02T00:00:00.000Z",
      policy: {
        renewalSoonWindowDays: 30,
        renewalRequiredWindowDays: 7,
      },
    });

    const staleExpired = service.evaluateIssuedCertificate({
      certificate: createIssuedCertificate({
        status: CertificateStatuses.expired,
        notAfter: "2026-12-01T00:00:00.000Z",
      }),
      asOf: "2026-08-02T00:00:00.000Z",
      policy: {
        renewalSoonWindowDays: 30,
        renewalRequiredWindowDays: 7,
      },
    });

    expect(staleIssued.stale).toBe(true);
    expect(staleIssued.attentionCodes).toContain("certificate-status-stale-expired");
    expect(staleExpired.stale).toBe(true);
    expect(staleExpired.attentionCodes).toContain("certificate-status-stale-issued");
  });

  it("evaluates CA rotation timing with operator attention flags", () => {
    const service = new CertificateRenewalPlanningService();
    const authority = createAuthority({
      status: CertificateAuthorityStatuses.compromised,
      autoRotateEnabled: false,
      notAfter: "2026-09-10T00:00:00.000Z",
      rotateBeforeExpiryDays: 15,
      nextRotationDueAt: "2026-08-20T00:00:00.000Z",
    });

    const assessment = service.evaluateCertificateAuthority({
      authority,
      asOf: "2026-09-01T00:00:00.000Z",
      policy: {
        renewalSoonLeadDays: 30,
      },
    });

    expect(assessment.renewalState).toBe(CertificateRenewalStates.renewalRequired);
    expect(assessment.attentionCodes).toContain("ca-status-not-active");
    expect(assessment.attentionCodes).toContain("ca-rotation-required");
    expect(assessment.attentionCodes).toContain("ca-autorotate-disabled-manual-rotation-required");
    expect(assessment.attentionCodes).toContain("ca-next-rotation-due");
  });
});

function createIssuedCertificate(input: {
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly notAfter: string;
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: "AA11",
    status: input.status,
    subject: {
      commonName: "node-01.ai-loom.internal",
      dnsNames: ["node-01.ai-loom.internal"],
      ipAddresses: [],
      uriSanEntries: [],
    },
    subjectReference: {
      kind: "node",
      referenceId: "node:01",
    },
    usages: ["server-auth"],
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: input.notAfter,
    },
    issuedAt: "2026-01-01T00:00:00.000Z",
    certificateMaterialRef: "trust:cert:node:01:v1",
    publicKeyAlgorithm: "rsa-4096",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createAuthority(input: {
  readonly status: CertificateAuthorityRootPersistenceRecord["status"];
  readonly autoRotateEnabled: boolean;
  readonly rotateBeforeExpiryDays: number;
  readonly notAfter: string;
  readonly nextRotationDueAt?: string;
}): CertificateAuthorityRootPersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    displayName: "AI Loom Internal Root",
    status: input.status,
    subject: {
      commonName: "AI Loom Internal Root CA",
      dnsNames: [],
      ipAddresses: [],
      uriSanEntries: [],
    },
    serialNumber: "A1B2C3",
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: input.notAfter,
    },
    signatureAlgorithm: "sha256WithRSAEncryption",
    rootCertificateMaterialRef: "trust:ca:cert:v1",
    rootPrivateKeyMaterialRef: "trust:ca:key:v1",
    rotationPolicy: {
      profileId: "rotation:default",
      autoRotateEnabled: input.autoRotateEnabled,
      rotateBeforeExpiryDays: input.rotateBeforeExpiryDays,
      overlapDays: 30,
      maxLifetimeDays: 3650,
      nextRotationDueAt: input.nextRotationDueAt,
    },
    compromisedAt: input.status === CertificateAuthorityStatuses.compromised
      ? "2026-06-01T00:00:00.000Z"
      : undefined,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "system-bootstrap",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "system-bootstrap",
    revision: 1,
  });
}

