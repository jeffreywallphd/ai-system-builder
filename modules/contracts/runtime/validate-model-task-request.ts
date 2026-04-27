export interface ValidateModelTaskRequest {
  modelRecordId: string;
  modelPath: string;
  expectedLoRA?: boolean;
  expectedRecurrentAdditions?: boolean;
}
