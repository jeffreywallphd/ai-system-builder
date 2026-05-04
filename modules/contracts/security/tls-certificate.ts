export type TlsCertificateMode = "manual" | "auto-self-signed" | "auto-local-ca";

export interface TlsCertificateStatus {
  mode: TlsCertificateMode;
  enabled: boolean;
  source: "manual" | "generated" | "reused" | "not-required";
  certificatePath?: string;
  certificateDirectory?: string;
  hosts: readonly string[];
  expiresAt?: string;
}
