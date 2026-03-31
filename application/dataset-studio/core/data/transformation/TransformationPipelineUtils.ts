import type { ZodIssue } from "zod";
import { ZodError } from "zod";
import type { TransformationInputData } from "./TransformationContracts";
import { sampleTransformationInputData } from "./TransformationSampling";

export interface TransformationPipelineErrorDetails {
  readonly name: string;
  readonly message: string;
  readonly issues?: ReadonlyArray<Readonly<{ path: string; message: string }>>;
}

export interface TransformationDataSummary {
  readonly kind: TransformationInputData["kind"];
  readonly rowCount: number;
}

function issuePathToString(path: ZodIssue["path"]): string {
  return path.length > 0 ? path.join(".") : "root";
}

export function countTransformationDataRows(data: TransformationInputData): number {
  if (data.kind === "records") {
    return data.records.length;
  }
  return data.rows.length;
}

export function summarizeTransformationData(data: TransformationInputData): TransformationDataSummary {
  return Object.freeze({
    kind: data.kind,
    rowCount: countTransformationDataRows(data),
  });
}

export function normalizeTransformationPipelineError(error: unknown): TransformationPipelineErrorDetails {
  if (error instanceof ZodError) {
    return Object.freeze({
      name: error.name,
      message: "Validation failed.",
      issues: Object.freeze(error.issues.map((issue) => Object.freeze({
        path: issuePathToString(issue.path),
        message: issue.message,
      }))),
    });
  }

  if (error instanceof Error) {
    return Object.freeze({
      name: error.name,
      message: error.message,
    });
  }

  return Object.freeze({
    name: "UnknownError",
    message: "Unknown pipeline error.",
  });
}

export function samplePipelineData(
  data: TransformationInputData,
  sampleSize?: number,
): TransformationInputData {
  return sampleTransformationInputData(data, sampleSize);
}
