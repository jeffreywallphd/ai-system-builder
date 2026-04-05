import type { INodeEnrollmentRequestPersistenceRepository } from "./INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "./INodeTrustIdentityPersistenceRepository";

export interface NodeTrustPersistencePorts {
  readonly nodeTrustIdentityPersistenceRepository: INodeTrustIdentityPersistenceRepository;
  readonly nodeEnrollmentRequestPersistenceRepository: INodeEnrollmentRequestPersistenceRepository;
}
