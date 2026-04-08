import type {
  DeploymentPolicyAdminUpdateCommand,
  DeploymentPolicyAdministrationSnapshot,
  DeploymentPolicyAdministrationState,
  DeploymentPolicyValidationOutcome,
  ReadDeploymentPolicyAdministrationRequest,
  ReadDeploymentPolicyAdministrationResponse,
  UpdateDeploymentPolicyAdministrationRequest,
  UpdateDeploymentPolicyAdministrationResponse,
  ValidateDeploymentPolicyAdministrationRequest,
  ValidateDeploymentPolicyAdministrationResponse,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";

export interface ReadDeploymentPolicyAdministrationRequestDto extends ReadDeploymentPolicyAdministrationRequest {}

export interface ReadDeploymentPolicyAdministrationResponseDto extends ReadDeploymentPolicyAdministrationResponse {}

export interface ValidateDeploymentPolicyAdministrationRequestDto extends ValidateDeploymentPolicyAdministrationRequest {}

export interface ValidateDeploymentPolicyAdministrationResponseDto extends ValidateDeploymentPolicyAdministrationResponse {}

export interface UpdateDeploymentPolicyAdministrationRequestDto extends UpdateDeploymentPolicyAdministrationRequest {}

export interface UpdateDeploymentPolicyAdministrationResponseDto extends UpdateDeploymentPolicyAdministrationResponse {}

export interface PatchDeploymentPolicyAdministrationStateRequestDto {
  readonly profileId: DeploymentPolicyAdminUpdateCommand["profileId"];
  readonly actorUserIdentityId: string;
  readonly submittedAt?: string;
  readonly expectedRevision?: number;
  readonly state: DeploymentPolicyAdministrationState;
}

export interface PatchDeploymentPolicyAdministrationStateResponseDto {
  readonly profileId: DeploymentPolicyAdminUpdateCommand["profileId"];
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly newRevision: number;
}

export function toReadDeploymentPolicyAdministrationResponseDto(input: {
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation?: DeploymentPolicyValidationOutcome;
}): ReadDeploymentPolicyAdministrationResponseDto {
  return Object.freeze({
    snapshot: input.snapshot,
    validation: input.validation,
  });
}

export function toValidateDeploymentPolicyAdministrationResponseDto(
  validation: DeploymentPolicyValidationOutcome,
): ValidateDeploymentPolicyAdministrationResponseDto {
  return Object.freeze({
    validation,
  });
}

export function toUpdateDeploymentPolicyAdministrationResponseDto(input: {
  readonly applied: boolean;
  readonly profileId: DeploymentPolicyAdminUpdateCommand["profileId"];
  readonly newRevision: number;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly snapshot?: DeploymentPolicyAdministrationSnapshot;
}): UpdateDeploymentPolicyAdministrationResponseDto {
  return Object.freeze({
    applied: input.applied,
    profileId: input.profileId,
    newRevision: input.newRevision,
    validation: input.validation,
    snapshot: input.snapshot,
  });
}

export function toPatchDeploymentPolicyAdministrationStateResponseDto(input: {
  readonly profileId: DeploymentPolicyAdminUpdateCommand["profileId"];
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly newRevision: number;
}): PatchDeploymentPolicyAdministrationStateResponseDto {
  return Object.freeze({
    profileId: input.profileId,
    snapshot: input.snapshot,
    validation: input.validation,
    newRevision: input.newRevision,
  });
}
