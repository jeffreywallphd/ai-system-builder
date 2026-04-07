import { z } from "zod";

export const TransformationConfigUxFieldKinds = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  enum: "enum",
  array: "array",
  object: "object",
  record: "record",
  unknown: "unknown",
} as const);

export type TransformationConfigUxFieldKind =
  typeof TransformationConfigUxFieldKinds[keyof typeof TransformationConfigUxFieldKinds];

export const TransformationConfigUxVisibilities = Object.freeze({
  simple: "simple",
  advanced: "advanced",
} as const);

export type TransformationConfigUxVisibility =
  typeof TransformationConfigUxVisibilities[keyof typeof TransformationConfigUxVisibilities];

export interface TransformationConfigUxOption {
  readonly value: string | number | boolean;
  readonly label: string;
  readonly description?: string;
}

export interface TransformationConfigUxValidationConstraint {
  readonly key: string;
  readonly value: string | number | boolean;
}

export interface TransformationConfigUxFieldDescriptor {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: TransformationConfigUxFieldKind;
  readonly required: boolean;
  readonly visibility: TransformationConfigUxVisibility;
  readonly sectionId?: string;
  readonly defaultValue?: unknown;
  readonly options?: ReadonlyArray<TransformationConfigUxOption>;
  readonly constraints?: ReadonlyArray<TransformationConfigUxValidationConstraint>;
}

export interface TransformationConfigUxSectionDescriptor {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface TransformationAssetConfigUxDescriptor {
  readonly contractVersion: "1.0.0";
  readonly generatedAt: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly assetName: string;
  readonly assetDescription: string;
  readonly sections: ReadonlyArray<TransformationConfigUxSectionDescriptor>;
  readonly fields: ReadonlyArray<TransformationConfigUxFieldDescriptor>;
}

export interface TransformationPipelineStepConfigUxDescriptor {
  readonly contractVersion: "1.0.0";
  readonly generatedAt: string;
  readonly stepId: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly fields: ReadonlyArray<TransformationConfigUxFieldDescriptor>;
  readonly assetConfig: TransformationAssetConfigUxDescriptor;
}

export const TransformationConfigUxOptionSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
});

export const TransformationConfigUxValidationConstraintSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const TransformationConfigUxFieldDescriptorSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  kind: z.enum([
    TransformationConfigUxFieldKinds.string,
    TransformationConfigUxFieldKinds.number,
    TransformationConfigUxFieldKinds.boolean,
    TransformationConfigUxFieldKinds.enum,
    TransformationConfigUxFieldKinds.array,
    TransformationConfigUxFieldKinds.object,
    TransformationConfigUxFieldKinds.record,
    TransformationConfigUxFieldKinds.unknown,
  ]),
  required: z.boolean(),
  visibility: z.enum([TransformationConfigUxVisibilities.simple, TransformationConfigUxVisibilities.advanced]),
  sectionId: z.string().min(1).optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(TransformationConfigUxOptionSchema).optional(),
  constraints: z.array(TransformationConfigUxValidationConstraintSchema).optional(),
});

export const TransformationConfigUxSectionDescriptorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
});

export const TransformationAssetConfigUxDescriptorSchema = z.object({
  contractVersion: z.literal("1.0.0"),
  generatedAt: z.string().min(1),
  assetId: z.string().min(1),
  assetVersion: z.string().min(1),
  assetName: z.string().min(1),
  assetDescription: z.string().min(1),
  sections: z.array(TransformationConfigUxSectionDescriptorSchema),
  fields: z.array(TransformationConfigUxFieldDescriptorSchema),
});

export const TransformationPipelineStepConfigUxDescriptorSchema = z.object({
  contractVersion: z.literal("1.0.0"),
  generatedAt: z.string().min(1),
  stepId: z.string().min(1),
  assetId: z.string().min(1),
  assetVersion: z.string().min(1),
  fields: z.array(TransformationConfigUxFieldDescriptorSchema),
  assetConfig: TransformationAssetConfigUxDescriptorSchema,
});
