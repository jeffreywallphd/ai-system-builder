import type { IAuthorizationActorMembershipReadRepository } from "./IAuthorizationActorMembershipReadRepository";
import type { IAuthorizationPolicyEvaluator } from "./IAuthorizationPolicyEvaluator";
import type { IAuthorizationPolicyEventRecorder } from "./IAuthorizationPolicyEventRecorder";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "./IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "./IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "./IAuthorizationSharingGrantReadRepository";

export interface AuthorizationPolicyEvaluationPorts {
  readonly actorMembershipReadRepository: IAuthorizationActorMembershipReadRepository;
  readonly roleGrantReadRepository: IAuthorizationRoleGrantReadRepository;
  readonly sharingGrantReadRepository: IAuthorizationSharingGrantReadRepository;
  readonly resourcePolicyMetadataReadRepository: IAuthorizationResourcePolicyMetadataReadRepository;
  readonly policyEvaluator: IAuthorizationPolicyEvaluator;
  readonly policyEventRecorder?: IAuthorizationPolicyEventRecorder;
}
