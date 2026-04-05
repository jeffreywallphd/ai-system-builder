import type { TrustMaterialKind } from "../../../domain/security/CertificateAuthorityDomain";

export interface CertificateAuthorityProtectedMaterialDescriptor {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly secretRef: string;
  readonly secretRefRedacted: string;
  readonly keyScope: string;
  readonly source: string;
}

export interface SaveCertificateAuthorityProtectedMaterialInput {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly plaintextValue: string;
  readonly keyScope?: string;
  readonly secretRef?: string;
}

export interface LoadCertificateAuthorityProtectedMaterialInput {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly secretRef: string;
  readonly keyScope?: string;
}

export interface PersistCertificateAuthorityRootMaterialsInput {
  readonly certificateAuthorityId: string;
  readonly actorUserIdentityId: string;
  readonly reason?: string;
  readonly materials: ReadonlyArray<SaveCertificateAuthorityProtectedMaterialInput>;
}

export interface LoadCertificateAuthorityRootMaterialsInput {
  readonly certificateAuthorityId: string;
  readonly reason?: string;
  readonly materials: ReadonlyArray<LoadCertificateAuthorityProtectedMaterialInput>;
}

export interface LoadedCertificateAuthorityProtectedMaterial {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly plaintextValue: string;
}

export interface ICertificateAuthorityRootMaterialStorage {
  persistRootMaterials(
    input: PersistCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<CertificateAuthorityProtectedMaterialDescriptor>>;
  loadRootMaterials(
    input: LoadCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<LoadedCertificateAuthorityProtectedMaterial>>;
}
