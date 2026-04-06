import type {
  ICredentialMaterialQueryRepository,
  ICredentialMaterialRepository,
  ICredentialMaterialWriteRepository,
} from "./ICredentialMaterialRepository";
import type { IIdentityLookupRepository } from "./IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "./IIdentityPersistenceRepository";
import type {
  IIdentitySessionQueryRepository,
  IIdentitySessionRepository,
  IIdentitySessionWriteRepository,
} from "./IIdentitySessionRepository";
import type {
  IIdentitySessionTokenMaterialQueryRepository,
  IIdentitySessionTokenMaterialRepository,
  IIdentitySessionTokenMaterialWriteRepository,
} from "./IIdentitySessionTokenMaterialRepository";

export interface IdentityQueryRepositoryPorts {
  readonly identityLookupRepository: IIdentityLookupRepository;
  readonly credentialMaterialQueryRepository: ICredentialMaterialQueryRepository;
  readonly sessionQueryRepository: IIdentitySessionQueryRepository;
  readonly sessionTokenMaterialQueryRepository: IIdentitySessionTokenMaterialQueryRepository;
}

export interface IdentityWriteRepositoryPorts {
  readonly identityPersistenceRepository: IIdentityPersistenceRepository;
  readonly credentialMaterialWriteRepository: ICredentialMaterialWriteRepository;
  readonly sessionWriteRepository: IIdentitySessionWriteRepository;
  readonly sessionTokenMaterialWriteRepository: IIdentitySessionTokenMaterialWriteRepository;
}

export interface IdentityRepositoryPorts
  extends IdentityQueryRepositoryPorts, IdentityWriteRepositoryPorts {
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly sessionRepository: IIdentitySessionRepository;
  readonly sessionTokenMaterialRepository: IIdentitySessionTokenMaterialRepository;
}
