import { describe, expect, it } from "bun:test";
import {
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
  createCertificateSubjectDescriptor,
} from "../CertificateAuthorityDomain";
import {
  CertificateSubjectProfileKinds,
  evaluateCertificateIssuancePolicy,
  getCertificateSubjectProfileDefinition,
  listCertificateSubjectProfileDefinitions,
} from "../CertificateIssuancePolicyDomain";

describe("CertificateIssuancePolicyDomain", () => {
  it("defines explicit typed subject profiles for current and future pathways", () => {
    const profiles = listCertificateSubjectProfileDefinitions();
    expect(profiles.map((profile) => profile.kind)).toEqual([
      CertificateSubjectProfileKinds.authoritativeServer,
      CertificateSubjectProfileKinds.approvedNode,
      CertificateSubjectProfileKinds.internalService,
      CertificateSubjectProfileKinds.trustedDevice,
    ]);

    const deviceProfile = getCertificateSubjectProfileDefinition(CertificateSubjectProfileKinds.trustedDevice);
    expect(deviceProfile.issuanceEnabled).toBeFalse();
  });

  it("requires authoritative-server subjects to include DNS SAN and server reference", () => {
    const result = evaluateCertificateIssuancePolicy({
      profileKind: CertificateSubjectProfileKinds.authoritativeServer,
      subject: createCertificateSubjectDescriptor({
        commonName: "authoritative.ai-loom.internal",
        dnsNames: ["authoritative.ai-loom.internal"],
      }),
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.service,
        referenceId: "server:authoritative",
      },
      usages: [
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
      ],
      validityDays: 365,
    });

    expect(result.allowed).toBeTrue();
    expect(result.violations).toHaveLength(0);
  });

  it("enforces node profile URI SAN and required usages", () => {
    const result = evaluateCertificateIssuancePolicy({
      profileKind: CertificateSubjectProfileKinds.approvedNode,
      subject: createCertificateSubjectDescriptor({
        commonName: "node-1.ai-loom.internal",
        dnsNames: ["node-1.ai-loom.internal"],
        uriSanEntries: [],
      }),
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.node,
        referenceId: "node:compute:1",
      },
      usages: [
        CertificateUsageKinds.clientAuth,
      ],
      validityDays: 397,
    });

    expect(result.allowed).toBeFalse();
    expect(result.violations.some((violation) => violation.includes("URI SAN"))).toBeTrue();
    expect(result.violations.some((violation) => violation.includes("node-enrollment"))).toBeTrue();
  });

  it("separates internal-service from authoritative-server reference paths", () => {
    const result = evaluateCertificateIssuancePolicy({
      profileKind: CertificateSubjectProfileKinds.internalService,
      subject: createCertificateSubjectDescriptor({
        commonName: "api.ai-loom.internal",
        dnsNames: ["api.ai-loom.internal"],
      }),
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.service,
        referenceId: "server:authoritative",
      },
      usages: [
        CertificateUsageKinds.serviceIdentity,
      ],
      validityDays: 60,
    });

    expect(result.allowed).toBeFalse();
    expect(result.violations.some((violation) => violation.includes("must start with 'service:'"))).toBeTrue();
  });
});
