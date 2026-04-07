import { FileIngestionPolicyService } from "../../../../src/domain/ingestion/FileIngestionServices";
import type { FileIngestionPolicy } from "../../../../src/domain/ingestion/interfaces/IFileIngestion";
import type {
  ImageUploadIngestionAdapter,
  ImageUploadValidationIssue,
  ImageUploadValidationResult,
} from "./ImageUiContracts";

function freezeIssues(issues: ReadonlyArray<ImageUploadValidationIssue>): ReadonlyArray<ImageUploadValidationIssue> {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
}

export function createBrowserImageUploadIngestionAdapter(input: {
  readonly policy: FileIngestionPolicy;
  readonly policyService?: FileIngestionPolicyService;
}): ImageUploadIngestionAdapter {
  const policyService = input.policyService ?? new FileIngestionPolicyService();

  return Object.freeze({
    evaluate({ files, maxUploadCount }) {
      const acceptedFiles: File[] = [];
      const rejectedFiles: File[] = [];
      const issues: ImageUploadValidationIssue[] = [];

      files.forEach((file) => {
        if (maxUploadCount !== undefined && acceptedFiles.length >= maxUploadCount) {
          rejectedFiles.push(file);
          issues.push({
            severity: "error",
            code: "max_upload_count_exceeded",
            fileName: file.name,
            message: `Upload limit reached (${maxUploadCount}).`,
          });
          return;
        }

        try {
          const evaluation = policyService.evaluateRequest({
            file: {
              name: file.name,
              sizeInBytes: file.size,
              mimeType: file.type || undefined,
              lastModifiedAt: new Date(file.lastModified),
            },
            content: new Uint8Array(0),
            provenance: {
              source: "ui-image-upload-panel",
              capturedAt: new Date(),
              metadata: { stage: "pre-ingestion-validation" },
            },
          }, input.policy);

          acceptedFiles.push(file);
          evaluation.warnings.forEach((warning) => {
            issues.push({
              severity: "warning",
              code: warning.code,
              fileName: file.name,
              message: warning.message,
              details: warning.details,
            });
          });
        } catch (error) {
          rejectedFiles.push(file);
          issues.push({
            severity: "error",
            code: error instanceof Error ? error.name : "validation_error",
            fileName: file.name,
            message: error instanceof Error ? error.message : "File failed validation.",
          });
        }
      });

      const result: ImageUploadValidationResult = {
        acceptedFiles: Object.freeze(acceptedFiles),
        rejectedFiles: Object.freeze(rejectedFiles),
        issues: freezeIssues(issues),
      };
      return Object.freeze(result);
    },
  });
}
