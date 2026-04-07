export interface CertificateAuthoritySecretMetadata {
  readonly secretRef: string;
  readonly exists: boolean;
  readonly source: string;
}

export interface ICertificateAuthorityBootstrapSecretService {
  getSecretMetadata(secretRef: string): Promise<CertificateAuthoritySecretMetadata>;
}
