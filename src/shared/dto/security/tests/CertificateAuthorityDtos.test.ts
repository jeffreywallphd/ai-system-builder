import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
} from "../../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateAuthorityPersistenceQueryPresets,
  CertificateDistributionTargetKinds,
  normalizeCertificateAuthorityMutationOperationKey,
  toCertificateAuthorityStatusLookupKey,
  toCertificateDistributionTargetLookupKey,
  toCertificateStatusLookupKey,
  toCertificateSubjectLookupKey,
} from "../CertificateAuthorityDtos";

describe("CertificateAuthorityDtos", () => {
  it("provides deterministic lookup key helpers", () => {
    expect(toCertificateStatusLookupKey(CertificateStatuses.issued)).toBe("certificate-status:issued");
    expect(toCertificateAuthorityStatusLookupKey(CertificateAuthorityStatuses.active)).toBe(
      "certificate-authority-status:active",
    );
    expect(toCertificateSubjectLookupKey({
      kind: CertificateSubjectReferenceKinds.node,
      referenceId: "node:1",
      workspaceId: "workspace:a",
    })).toBe("certificate-subject:node:node:1:workspace:a");
    expect(toCertificateDistributionTargetLookupKey({
      kind: CertificateDistributionTargetKinds.server,
      referenceId: "server:authoritative",
      workspaceId: "workspace:a",
    })).toBe("certificate-distribution-target:server:server:authoritative:workspace:a");
  });

  it("exposes active/revoked query presets", () => {
    expect(CertificateAuthorityPersistenceQueryPresets.activeStatuses).toEqual([
      CertificateAuthorityStatuses.active,
    ]);
    expect(CertificateAuthorityPersistenceQueryPresets.revokedCertificateStatuses).toEqual([
      CertificateStatuses.revoked,
    ]);
  });

  it("normalizes mutation operation keys", () => {
    expect(normalizeCertificateAuthorityMutationOperationKey("  op-1  ")).toBe("op-1");
    expect(() => normalizeCertificateAuthorityMutationOperationKey("   ")).toThrow(
      "operationKey is required",
    );
  });
});
