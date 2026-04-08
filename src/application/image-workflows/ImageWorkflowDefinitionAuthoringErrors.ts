export const ImageWorkflowDefinitionAuthoringErrorCodes = Object.freeze({
  invalidRequest: "image-workflow-definition-invalid-request",
  unauthorized: "image-workflow-definition-unauthorized",
  notFound: "image-workflow-definition-not-found",
  conflict: "image-workflow-definition-conflict",
  validationFailed: "image-workflow-definition-validation-failed",
  incomplete: "image-workflow-definition-incomplete",
  lifecycleTransitionDenied: "image-workflow-definition-lifecycle-transition-denied",
});

export type ImageWorkflowDefinitionAuthoringErrorCode =
  typeof ImageWorkflowDefinitionAuthoringErrorCodes[keyof typeof ImageWorkflowDefinitionAuthoringErrorCodes];

export class ImageWorkflowDefinitionAuthoringError extends Error {
  public readonly code: ImageWorkflowDefinitionAuthoringErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ImageWorkflowDefinitionAuthoringErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "ImageWorkflowDefinitionAuthoringError";
    this.code = code;
    this.details = details;
  }
}
