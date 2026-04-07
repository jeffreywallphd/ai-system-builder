export interface CertificateAuthorityBootstrapConfiguration {
  readonly certificateAuthorityId?: string;
  readonly rootCertificateMaterialRef?: string;
  readonly rootPrivateKeyMaterialRef?: string;
  readonly rootCertificateSecretRef?: string;
  readonly rootPrivateKeySecretRef?: string;
  readonly source: string;
}

export interface ICertificateAuthorityBootstrapConfigurationProvider {
  loadConfiguration(): Promise<CertificateAuthorityBootstrapConfiguration>;
}
