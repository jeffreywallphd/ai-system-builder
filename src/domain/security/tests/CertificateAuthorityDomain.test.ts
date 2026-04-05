import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityDomainError,
  CertificateAuthorityLifecycleTransitionError,
  CertificateAuthorityStatuses,
  CertificateRevocationReasons,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
  TrustMaterialKinds,
  createCertificateAuthorityRoot,
  createCertificateSerialNumber,
  createCertificateSubjectDescriptor,
  createCertificateValidityWindow,
  createIssuedCertificate,
  createTrustMaterialReference,
  isCertificateAuthorityTransitionAllowed,
  isIssuedCertificateActiveAt,
  revokeIssuedCertificate,
  supersedeIssuedCertificate,
  transitionCertificateAuthorityStatus,
  updateCertificateAuthorityRotationPolicy,
} from "../CertificateAuthorityDomain";

describe("CertificateAuthorityDomain", () => {
  it("creates certificate authority roots with rotation metadata", () => {
    const certificateAuthority = createCertificateAuthorityRoot({
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: createCertificateSubjectDescriptor({
        commonName: "AI Loom Internal Root CA",
        organization: "AI Loom",
        country: "US",
      }),
      serialNumber: createCertificateSerialNumber("A1B2C3"),
      validity: createCertificateValidityWindow({
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2036-04-05T12:00:00.000Z",
      }),
      signatureAlgorithm: "sha256WithRSAEncryption",
      rootCertificateMaterialRef: "trust:ca-root-cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca-root-key:v1",
      rotationPolicy: {
        profileId: "rotation:root-default",
        autoRotateEnabled: true,
        rotateBeforeExpiryDays: 90,
        overlapDays: 30,
        maxLifetimeDays: 3650,
        nextRotationDueAt: "2035-01-05T00:00:00.000Z",
      },
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    expect(certificateAuthority.status).toBe(CertificateAuthorityStatuses.active);
    expect(certificateAuthority.rotationPolicy.autoRotateEnabled).toBeTrue();
    expect(certificateAuthority.subject.country).toBe("US");
  });

  it("issues certificates with subject references and usage metadata", () => {
    const certificate = createIssuedCertificate({
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: createCertificateSerialNumber("F00D01"),
      subject: createCertificateSubjectDescriptor({
        commonName: "node-compute-001.ai-loom.internal",
        organization: "AI Loom",
        dnsNames: ["node-compute-001.ai-loom.internal"],
      }),
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.node,
        referenceId: "node:compute:001",
      },
      usages: [
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
      ],
      validity: createCertificateValidityWindow({
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2027-04-05T12:00:00.000Z",
      }),
      issuedAt: "2026-04-05T12:00:00.000Z",
      certificateMaterialRef: "trust:cert:node-compute-001:v1",
      certificateChainMaterialRef: "trust:cert-chain:root:v1",
      trustMaterialRef: "trust:bundle:node-compute-001:v1",
      publicKeyAlgorithm: "rsa-4096",
      publicKeyFingerprintSha256: "ABCDEF1234",
    });

    expect(certificate.status).toBe(CertificateStatuses.issued);
    expect(certificate.subjectReference.kind).toBe(CertificateSubjectReferenceKinds.node);
    expect(certificate.usages).toContain(CertificateUsageKinds.serverAuth);
  });

  it("revokes and supersedes issued certificates with lifecycle invariants", () => {
    const issued = createIssuedCertificate({
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: createCertificateSerialNumber("C0FFEE"),
      subject: createCertificateSubjectDescriptor({
        commonName: "service-api.ai-loom.internal",
      }),
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.service,
        referenceId: "service:api",
      },
      usages: [CertificateUsageKinds.serviceIdentity],
      validity: createCertificateValidityWindow({
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2027-04-05T12:00:00.000Z",
      }),
      issuedAt: "2026-04-05T12:00:00.000Z",
      certificateMaterialRef: "trust:cert:service-api:v1",
      publicKeyAlgorithm: "ed25519",
    });

    const revoked = revokeIssuedCertificate(issued, {
      reason: CertificateRevocationReasons.keyCompromise,
      revokedAt: "2026-06-01T00:00:00.000Z",
      revokedByActorId: "user:security-admin",
    });

    const superseded = supersedeIssuedCertificate(
      issued,
      createCertificateSerialNumber("D00D01"),
      new Date("2026-05-01T00:00:00.000Z"),
    );

    expect(revoked.status).toBe(CertificateStatuses.revoked);
    expect(revoked.revocation?.reason).toBe(CertificateRevocationReasons.keyCompromise);
    expect(superseded.status).toBe(CertificateStatuses.superseded);
    expect(superseded.supersededBySerialNumber).toBe("D00D01");
  });

  it("enforces authority transition rules and rotation updates", () => {
    const certificateAuthority = createCertificateAuthorityRoot({
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: createCertificateSubjectDescriptor({
        commonName: "AI Loom Internal Root CA",
      }),
      serialNumber: createCertificateSerialNumber("ABCDEF01"),
      validity: createCertificateValidityWindow({
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2036-04-05T12:00:00.000Z",
      }),
      signatureAlgorithm: "sha384WithRSAEncryption",
      rootCertificateMaterialRef: "trust:ca-root-cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca-root-key:v1",
      rotationPolicy: {
        profileId: "rotation:root-default",
        autoRotateEnabled: true,
        rotateBeforeExpiryDays: 120,
        overlapDays: 30,
        maxLifetimeDays: 3650,
      },
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    const retired = transitionCertificateAuthorityStatus(
      certificateAuthority,
      CertificateAuthorityStatuses.retired,
      new Date("2035-01-01T00:00:00.000Z"),
    );

    const updatedRotation = updateCertificateAuthorityRotationPolicy(
      certificateAuthority,
      {
        profileId: "rotation:root-default",
        autoRotateEnabled: true,
        rotateBeforeExpiryDays: 180,
        overlapDays: 45,
        maxLifetimeDays: 3650,
        nextRotationDueAt: "2034-06-01T00:00:00.000Z",
      },
      new Date("2028-01-01T00:00:00.000Z"),
    );

    expect(isCertificateAuthorityTransitionAllowed(CertificateAuthorityStatuses.active, CertificateAuthorityStatuses.retired)).toBeTrue();
    expect(retired.retiredAt).toBe("2035-01-01T00:00:00.000Z");
    expect(updatedRotation.rotationPolicy.rotateBeforeExpiryDays).toBe(180);

    expect(() => transitionCertificateAuthorityStatus(
      retired,
      CertificateAuthorityStatuses.active,
      new Date("2035-06-01T00:00:00.000Z"),
    )).toThrow(CertificateAuthorityLifecycleTransitionError);
  });

  it("validates active status checks and trust-material invariants", () => {
    const certificate = createIssuedCertificate({
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: createCertificateSerialNumber("AA11BB22"),
      subject: createCertificateSubjectDescriptor({
        commonName: "device-01.ai-loom.internal",
      }),
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.device,
        referenceId: "device:01",
      },
      usages: [CertificateUsageKinds.deviceTrust],
      validity: createCertificateValidityWindow({
        notBefore: "2026-04-05T12:00:00.000Z",
        notAfter: "2026-12-05T12:00:00.000Z",
      }),
      issuedAt: "2026-04-05T12:00:00.000Z",
      certificateMaterialRef: "trust:cert:device-01:v1",
      publicKeyAlgorithm: "ed25519",
    });

    expect(isIssuedCertificateActiveAt(certificate, "2026-06-01T00:00:00.000Z")).toBeTrue();
    expect(isIssuedCertificateActiveAt(certificate, "2027-01-01T00:00:00.000Z")).toBeFalse();

    const trustMaterial = createTrustMaterialReference({
      materialRef: "trust:bundle:root:v1",
      kind: TrustMaterialKinds.certificateChainPem,
      storageLocator: "vault://ca/trust/bundle/root-v1",
      fingerprintSha256: "AA-BB-CC",
      createdAt: "2026-04-05T12:05:00.000Z",
    });

    expect(trustMaterial.kind).toBe(TrustMaterialKinds.certificateChainPem);

    expect(() => createCertificateSerialNumber("invalid serial")).toThrow(CertificateAuthorityDomainError);
  });
});
