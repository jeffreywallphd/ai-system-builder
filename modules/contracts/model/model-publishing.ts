import type { ModelValidationStatus } from "./model-validation";

export interface PublishModelRequest {
  modelRecordId: string;
  repository: string;
  owner?: string;
  revision?: string;
  private?: boolean;
  pathPrefix?: string;
  token?: string;
  allowInvalid?: boolean;
  forceRevalidate?: boolean;
}

export interface PublishModelResult {
  modelRecordId: string;
  published: boolean;
  provider: "huggingface";
  repository: string;
  revision?: string;
  url?: string;
  validationStatus?: ModelValidationStatus;
  warnings?: string[];
  errors?: string[];
}
