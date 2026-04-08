export const ImageWorkflowSystemQueryErrorCodes = Object.freeze({
  invalidRequest: "image-workflow-system-query-invalid-request",
  unauthorized: "image-workflow-system-query-unauthorized",
  notFound: "image-workflow-system-query-not-found",
});

export type ImageWorkflowSystemQueryErrorCode =
  typeof ImageWorkflowSystemQueryErrorCodes[keyof typeof ImageWorkflowSystemQueryErrorCodes];

export class ImageWorkflowSystemQueryError extends Error {
  public readonly code: ImageWorkflowSystemQueryErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: ImageWorkflowSystemQueryErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "ImageWorkflowSystemQueryError";
    this.code = code;
    this.details = details;
  }
}
