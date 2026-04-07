import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
} from "@domain/security/CertificateAuthorityDomain";
import {
  CertificateAuthorityIntrospectionDiagnosticSeverities,
  CertificateAuthorityIntrospectionStates,
  CertificateLinkedSubjectTrustStates,
  CertificateAuthorityPersistenceQueryPresets,
  CertificateDistributionTargetKinds,
  CertificateTrustEvaluationStatuses,
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

  it("exposes introspection state and diagnostic severity vocabularies", () => {
    expect(CertificateAuthorityIntrospectionStates.healthy).toBe("healthy");
    expect(CertificateAuthorityIntrospectionStates.blocked).toBe("blocked");
    expect(CertificateAuthorityIntrospectionDiagnosticSeverities.error).toBe("error");
  });

  it("exposes trust evaluation vocabularies", () => {
    expect(CertificateTrustEvaluationStatuses.active).toBe("active");
    expect(CertificateTrustEvaluationStatuses.subjectInactive).toBe("subject-inactive");
    expect(CertificateTrustEvaluationStatuses.invalid).toBe("invalid");
    expect(CertificateLinkedSubjectTrustStates.revoked).toBe("revoked");
  });

  it("supports runtime trust material package DTO shape", () => {
    const candidate = {
      packageId: "runtime-trust-package:node:node:alpha:ca:internal:root:v1:AA11",
      occurredAt: "2026-04-05T01:00:00.000Z",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "AA11",
      targetKind: CertificateDistributionTargetKinds.node,
      targetReferenceId: "node:alpha",
      protectedReferences: [{
        materialRef: "trust:cert:node:alpha:v1",
        kind: "certificate-pem",
        accessRef: "secret-store:node-alpha-cert",
        accessRefRedacted: "secret-stor...a-cert",
      }],
    } as const;

    expect(candidate.targetKind).toBe("node");
    expect(candidate.protectedReferences).toHaveLength(1);
  });
});

