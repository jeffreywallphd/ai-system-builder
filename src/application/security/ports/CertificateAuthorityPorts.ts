import type { ICertificateAuthorityRootPersistenceRepository } from "./ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateAuthorityIssuerPort } from "./ICertificateAuthorityIssuerPort";
import type { ICertificateLifecycleEventPersistenceRepository } from "./ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "./IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialDistributionPort } from "./ITrustMaterialDistributionPort";
import type { ITrustMaterialReferencePersistenceRepository } from "./ITrustMaterialReferencePersistenceRepository";

export interface CertificateAuthorityPersistencePorts {
  readonly certificateAuthorityRootPersistenceRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly issuedCertificatePersistenceRepository: IIssuedCertificatePersistenceRepository;
  readonly trustMaterialReferencePersistenceRepository: ITrustMaterialReferencePersistenceRepository;
  readonly certificateLifecycleEventPersistenceRepository: ICertificateLifecycleEventPersistenceRepository;
}

export interface CertificateAuthorityCryptoPorts {
  readonly certificateAuthorityIssuerPort: ICertificateAuthorityIssuerPort;
  readonly trustMaterialDistributionPort?: ITrustMaterialDistributionPort;
}
