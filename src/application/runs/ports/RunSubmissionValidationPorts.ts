import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import type { ProtectedDataClass } from "@domain/security/EncryptionAtRestPolicyDomain";

export interface RunSubmissionTargetResolutionRequest {
  readonly workspaceId: string;
  readonly systemId: string;
  readonly versionId: string;
  readonly templateId?: string;
  readonly workflowId?: string;
  readonly occurredAt?: string;
}

export interface RunSubmissionTargetResolutionResult {
  readonly systemExists: boolean;
  readonly versionExists: boolean;
  readonly templateExists?: boolean;
  readonly workflowExists?: boolean;
  readonly workflowWorkspaceId?: string;
  readonly allowedParameterKeys?: ReadonlyArray<string>;
  readonly requiredPolicyPrerequisiteIds?: ReadonlyArray<string>;
}

export interface IRunSubmissionTargetResolverPort {
  resolveRunSubmissionTarget(
    request: RunSubmissionTargetResolutionRequest,
  ): Promise<RunSubmissionTargetResolutionResult>;
}

export const RunSubmissionSecurityPrerequisiteKinds = Object.freeze({
  contentEncryptionRequired: "content-encryption-required",
  previewDecryptionAllowed: "preview-decryption-allowed",
  workerDecryptionAllowed: "worker-decryption-allowed",
  custom: "custom",
});

export type RunSubmissionSecurityPrerequisiteKind =
  typeof RunSubmissionSecurityPrerequisiteKinds[keyof typeof RunSubmissionSecurityPrerequisiteKinds];

export interface RunSubmissionSecurityPrerequisite {
  readonly id?: string;
  readonly kind: RunSubmissionSecurityPrerequisiteKind;
  readonly dataClass?: ProtectedDataClass;
  readonly storageInstanceId?: string;
  readonly expected?: boolean;
}

export interface RunSubmissionResourceReference {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly requiredPermissionKey?: string;
}

export interface RunSubmissionStorageReference {
  readonly storageInstanceId: string;
  readonly requiredAction?: string;
}
