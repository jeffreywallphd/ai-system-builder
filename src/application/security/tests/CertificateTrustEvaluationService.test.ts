import { describe, expect, it } from "bun:test";
import { CertificateStatuses } from "../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateLinkedSubjectTrustStates,
  CertificateTrustEvaluationStatuses,
  type IssuedCertificatePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import { CertificateTrustEvaluationService } from "../use-cases/CertificateTrustEvaluationService";

describe("CertificateTrustEvaluationService", () => {
  it("treats notBefore as inclusive and notAfter as exclusive", () => {
    const service = new CertificateTrustEvaluationService();
    const certificate = createIssuedRecord({
      serialNumber: "AABBCC",
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2026-04-06T12:00:00.000Z",
    });

    const atNotBefore = service.evaluateIssuedCertificateTrust({
      serialNumber: "AABBCC",
      certificate,
      asOf: "2026-04-05T12:00:00.000Z",
    });
    const atNotAfter = service.evaluateIssuedCertificateTrust({
      serialNumber: "AABBCC",
      certificate,
      asOf: "2026-04-06T12:00:00.000Z",
    });

    expect(atNotBefore.status).toBe(CertificateTrustEvaluationStatuses.active);
    expect(atNotBefore.usable).toBeTrue();
    expect(atNotAfter.status).toBe(CertificateTrustEvaluationStatuses.expired);
    expect(atNotAfter.usable).toBeFalse();
  });

  it("prioritizes revoked status even before certificate expiry", () => {
    const service = new CertificateTrustEvaluationService();
    const certificate = createIssuedRecord({
      serialNumber: "C0FFEE",
      status: CertificateStatuses.revoked,
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    });

    const result = service.evaluateIssuedCertificateTrust({
      serialNumber: "C0FFEE",
      certificate,
      asOf: "2026-06-01T00:00:00.000Z",
    });

    expect(result.status).toBe(CertificateTrustEvaluationStatuses.revoked);
    expect(result.revoked).toBeTrue();
    expect(result.expired).toBeFalse();
    expect(result.usable).toBeFalse();
  });

  it("returns not-yet-valid before validity start", () => {
    const service = new CertificateTrustEvaluationService();
    const certificate = createIssuedRecord({
      serialNumber: "DDCCBB",
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    });

    const result = service.evaluateIssuedCertificateTrust({
      serialNumber: "DDCCBB",
      certificate,
      asOf: "2026-04-05T11:59:59.999Z",
    });

    expect(result.status).toBe(CertificateTrustEvaluationStatuses.notYetValid);
    expect(result.active).toBeFalse();
  });

  it("returns subject-inactive when linked subject is not active", () => {
    const service = new CertificateTrustEvaluationService();
    const certificate = createIssuedRecord({
      serialNumber: "F00D11",
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    });

    const result = service.evaluateIssuedCertificateTrust({
      serialNumber: "F00D11",
      certificate,
      asOf: "2026-05-01T00:00:00.000Z",
      linkedSubjectState: CertificateLinkedSubjectTrustStates.suspended,
    });

    expect(result.status).toBe(CertificateTrustEvaluationStatuses.subjectInactive);
    expect(result.usable).toBeFalse();
    expect(result.linkedSubject?.state).toBe(CertificateLinkedSubjectTrustStates.suspended);
  });

  it("returns invalid for malformed validity metadata", () => {
    const service = new CertificateTrustEvaluationService();
    const certificate = createIssuedRecord({
      serialNumber: "EEDDCC",
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2026-04-05T12:00:00.000Z",
    });

    const result = service.evaluateIssuedCertificateTrust({
      serialNumber: "EEDDCC",
      certificate,
      asOf: "2026-05-01T00:00:00.000Z",
    });

    expect(result.status).toBe(CertificateTrustEvaluationStatuses.invalid);
    expect(result.diagnosticCode).toBe("certificate-metadata-invalid");
    expect(result.usable).toBeFalse();
  });
});

function createIssuedRecord(input: {
  readonly serialNumber: string;
  readonly status?: IssuedCertificatePersistenceRecord["status"];
  readonly notBefore: string;
  readonly notAfter: string;
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: input.status ?? CertificateStatuses.issued,
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
    usages: ["client-auth"],
    validity: {
      notBefore: input.notBefore,
      notAfter: input.notAfter,
    },
    issuedAt: input.notBefore,
    certificateMaterialRef: `trust:cert:${input.serialNumber.toLowerCase()}:v1`,
    publicKeyAlgorithm: "rsa-4096",
    createdAt: input.notBefore,
    createdBy: "user:admin",
    lastModifiedAt: input.notBefore,
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}
