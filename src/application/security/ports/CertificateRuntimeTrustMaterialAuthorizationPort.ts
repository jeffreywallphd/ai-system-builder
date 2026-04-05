import type {
  ResolveRuntimeTrustMaterialPackageInput,
} from "./ITrustMaterialDistributionPort";

export interface CertificateRuntimeTrustMaterialAuthorizationRequest {
  readonly targetKind: ResolveRuntimeTrustMaterialPackageInput["targetKind"];
  readonly targetReferenceId: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly includeLeafCertificate: boolean;
  readonly includeCertificateChain: boolean;
  readonly includeTrustBundle: boolean;
  readonly includeProtectedReferences: boolean;
  readonly occurredAt: string;
}

export interface CertificateRuntimeTrustMaterialAuthorizationHook {
  assertCanResolveRuntimeTrustMaterialPackage(input: {
    readonly actorUserIdentityId: string;
    readonly request: CertificateRuntimeTrustMaterialAuthorizationRequest;
  }): Promise<void>;
}
