import type { TrustMaterialKind } from "@domain/security/CertificateAuthorityDomain";

export interface PublishTrustBundleInput {
  readonly trustBundleRef: string;
  readonly certificateAuthorityId: string;
  readonly targetRef: string;
  readonly targetKind: "node" | "device" | "service";
  readonly distributionChannel: "pull" | "push" | "bootstrap";
  readonly materialRefs: ReadonlyArray<string>;
  readonly actorUserIdentityId: string;
}

export interface PublishTrustBundleResult {
  readonly trustBundleRef: string;
  readonly publishedAt: string;
  readonly versionTag?: string;
}

export interface RuntimeTrustMaterialProtectedReference {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly accessRef: string;
  readonly accessRefRedacted: string;
  readonly fingerprintSha256?: string;
}

export interface ResolveRuntimeTrustMaterialPackageInput {
  readonly operationKey: string;
  readonly actorUserIdentityId: string;
  readonly targetKind: "node" | "server" | "device" | "service";
  readonly targetReferenceId: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly includeLeafCertificate?: boolean;
  readonly includeCertificateChain?: boolean;
  readonly includeTrustBundle?: boolean;
  readonly includeProtectedReferences?: boolean;
  readonly occurredAt?: string;
}

export interface ResolveRuntimeTrustMaterialPackageResult {
  readonly packageId: string;
  readonly occurredAt: string;
  readonly certificateAuthorityId: string;
  readonly serialNumber?: string;
  readonly targetKind: ResolveRuntimeTrustMaterialPackageInput["targetKind"];
  readonly targetReferenceId: string;
  readonly workspaceId?: string;
  readonly leafCertificatePem?: string;
  readonly certificateChainPem?: string;
  readonly trustBundlePem?: string;
  readonly protectedReferences: ReadonlyArray<RuntimeTrustMaterialProtectedReference>;
}

export interface ITrustMaterialDistributionPort {
  publishTrustBundle(input: PublishTrustBundleInput): Promise<PublishTrustBundleResult>;
  resolveRuntimeTrustMaterialPackage(
    input: ResolveRuntimeTrustMaterialPackageInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageResult | undefined>;
}

