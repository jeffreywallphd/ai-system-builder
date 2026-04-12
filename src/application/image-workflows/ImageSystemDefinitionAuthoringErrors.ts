export const ImageSystemDefinitionAuthoringErrorCodes = Object.freeze({
  invalidRequest: "image-system-definition-invalid-request",
  unauthorized: "image-system-definition-unauthorized",
  notFound: "image-system-definition-not-found",
  conflict: "image-system-definition-conflict",
  validationFailed: "image-system-definition-validation-failed",
  incompatible: "image-system-definition-incompatible",
  lifecycleTransitionDenied: "image-system-definition-lifecycle-transition-denied",
});

export type ImageSystemDefinitionAuthoringErrorCode =
  typeof ImageSystemDefinitionAuthoringErrorCodes[keyof typeof ImageSystemDefinitionAuthoringErrorCodes];

export class ImageSystemDefinitionAuthoringError extends Error {
  public readonly code: ImageSystemDefinitionAuthoringErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ImageSystemDefinitionAuthoringErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "ImageSystemDefinitionAuthoringError";
    this.code = code;
    this.details = details;
  }
}
