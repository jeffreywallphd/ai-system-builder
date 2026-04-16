import {
  normalizeTransformArtifactReference,
  type TransformArtifactReference,
} from "./transform-artifact-reference";
import {
  normalizeTransformSpecification,
  type TransformSpecification,
  type TransformParameters,
} from "./transform-specification";

export interface TransformRecord<
  TParameters extends TransformParameters = TransformParameters,
> {
  id?: string;
  specification: TransformSpecification<TParameters>;
  inputs: TransformArtifactReference[];
  outputs: TransformArtifactReference[];
  startedAt?: string;
  completedAt?: string;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeTransformRecord<
  TParameters extends TransformParameters = TransformParameters,
>(
  record: TransformRecord<TParameters>,
): TransformRecord<TParameters> {
  return {
    ...record,
    id: normalizeOptionalText(record.id),
    specification: normalizeTransformSpecification(record.specification),
    inputs: record.inputs.map(normalizeTransformArtifactReference),
    outputs: record.outputs.map(normalizeTransformArtifactReference),
    startedAt: normalizeOptionalText(record.startedAt),
    completedAt: normalizeOptionalText(record.completedAt),
  };
}
