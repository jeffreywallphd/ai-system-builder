import type { TlsCertificateMode, TlsCertificateStatus } from "../../../contracts/security";

export interface ResolvedTlsCertificateMaterial {
  certPem: string;
  keyPem: string;
  certificatePath?: string;
  keyPath?: string;
  status: TlsCertificateStatus;
}

export interface TlsCertificateProviderPort {
  resolveCertificateMaterial(input: {
    httpsEnabled: boolean;
    httpsRequired: boolean;
    mode: TlsCertificateMode;
    manualCertPath?: string;
    manualKeyPath?: string;
    certificateDirectory: string;
    hosts: readonly string[];
    now: Date;
  }): Promise<ResolvedTlsCertificateMaterial | undefined>;
}
