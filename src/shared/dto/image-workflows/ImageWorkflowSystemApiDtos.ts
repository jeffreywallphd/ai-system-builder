import type {
  CreateImageSystemRequestDto as CreateImageSystemRequestContract,
  CreateImageSystemResponseDto as CreateImageSystemResponseContract,
  CreateImageWorkflowRequestDto as CreateImageWorkflowRequestContract,
  CreateImageWorkflowResponseDto as CreateImageWorkflowResponseContract,
  GetImageSystemRequestDto as GetImageSystemRequestContract,
  GetImageSystemResponseDto as GetImageSystemResponseContract,
  GetImageWorkflowRequestDto as GetImageWorkflowRequestContract,
  GetImageWorkflowResponseDto as GetImageWorkflowResponseContract,
  ImageSystemDefinitionDto,
  ImageWorkflowApiReadinessDto,
  ImageWorkflowApiValidationResultDto,
  ImageWorkflowDefinitionDto,
  ListImageSystemsRequestDto as ListImageSystemsRequestContract,
  ListImageSystemsResponseDto as ListImageSystemsResponseContract,
  ListImageWorkflowsRequestDto as ListImageWorkflowsRequestContract,
  ListImageWorkflowsResponseDto as ListImageWorkflowsResponseContract,
  UpdateImageSystemRequestDto as UpdateImageSystemRequestContract,
  UpdateImageSystemResponseDto as UpdateImageSystemResponseContract,
  UpdateImageWorkflowRequestDto as UpdateImageWorkflowRequestContract,
  UpdateImageWorkflowResponseDto as UpdateImageWorkflowResponseContract,
  ValidateImageSystemRequestDto as ValidateImageSystemRequestContract,
  ValidateImageSystemResponseDto as ValidateImageSystemResponseContract,
  ValidateImageWorkflowRequestDto as ValidateImageWorkflowRequestContract,
  ValidateImageWorkflowResponseDto as ValidateImageWorkflowResponseContract,
} from "@shared/contracts/image-workflows/ImageWorkflowSystemApiContracts";

export interface CreateImageWorkflowRequestDto extends CreateImageWorkflowRequestContract {}
export interface CreateImageWorkflowResponseDto extends CreateImageWorkflowResponseContract {}
export interface UpdateImageWorkflowRequestDto extends UpdateImageWorkflowRequestContract {}
export interface UpdateImageWorkflowResponseDto extends UpdateImageWorkflowResponseContract {}
export interface GetImageWorkflowRequestDto extends GetImageWorkflowRequestContract {}
export interface GetImageWorkflowResponseDto extends GetImageWorkflowResponseContract {}
export interface ListImageWorkflowsRequestDto extends ListImageWorkflowsRequestContract {}
export interface ListImageWorkflowsResponseDto extends ListImageWorkflowsResponseContract {}
export interface ValidateImageWorkflowRequestDto extends ValidateImageWorkflowRequestContract {}
export interface ValidateImageWorkflowResponseDto extends ValidateImageWorkflowResponseContract {}

export interface CreateImageSystemRequestDto extends CreateImageSystemRequestContract {}
export interface CreateImageSystemResponseDto extends CreateImageSystemResponseContract {}
export interface UpdateImageSystemRequestDto extends UpdateImageSystemRequestContract {}
export interface UpdateImageSystemResponseDto extends UpdateImageSystemResponseContract {}
export interface GetImageSystemRequestDto extends GetImageSystemRequestContract {}
export interface GetImageSystemResponseDto extends GetImageSystemResponseContract {}
export interface ListImageSystemsRequestDto extends ListImageSystemsRequestContract {}
export interface ListImageSystemsResponseDto extends ListImageSystemsResponseContract {}
export interface ValidateImageSystemRequestDto extends ValidateImageSystemRequestContract {}
export interface ValidateImageSystemResponseDto extends ValidateImageSystemResponseContract {}

export function toCreateImageWorkflowResponseDto(input: {
  readonly workflow: ImageWorkflowDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
  readonly contractVersion: CreateImageWorkflowResponseDto["contractVersion"];
}): CreateImageWorkflowResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    workflow: input.workflow,
    readiness: input.readiness,
    validation: input.validation,
  });
}

export function toUpdateImageWorkflowResponseDto(input: {
  readonly workflow: ImageWorkflowDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
  readonly contractVersion: UpdateImageWorkflowResponseDto["contractVersion"];
}): UpdateImageWorkflowResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    workflow: input.workflow,
    readiness: input.readiness,
    validation: input.validation,
  });
}

export function toGetImageWorkflowResponseDto(input: {
  readonly workflow: ImageWorkflowDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly contractVersion: GetImageWorkflowResponseDto["contractVersion"];
}): GetImageWorkflowResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    workflow: input.workflow,
    readiness: input.readiness,
  });
}

export function toCreateImageSystemResponseDto(input: {
  readonly system: ImageSystemDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
  readonly contractVersion: CreateImageSystemResponseDto["contractVersion"];
}): CreateImageSystemResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    system: input.system,
    readiness: input.readiness,
    validation: input.validation,
  });
}

export function toUpdateImageSystemResponseDto(input: {
  readonly system: ImageSystemDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly validation: ImageWorkflowApiValidationResultDto;
  readonly contractVersion: UpdateImageSystemResponseDto["contractVersion"];
}): UpdateImageSystemResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    system: input.system,
    readiness: input.readiness,
    validation: input.validation,
  });
}

export function toGetImageSystemResponseDto(input: {
  readonly system: ImageSystemDefinitionDto;
  readonly readiness: ImageWorkflowApiReadinessDto;
  readonly contractVersion: GetImageSystemResponseDto["contractVersion"];
}): GetImageSystemResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    system: input.system,
    readiness: input.readiness,
  });
}
