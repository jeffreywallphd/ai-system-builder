import { z } from "zod";
import type {
  CanonicalRecordValue,
  CanonicalTableColumn,
  CanonicalTableRow,
  CanonicalTextItem,
  CanonicalImageStructuredItem,
  CanonicalRecordItem,
} from "./CanonicalDataShapes";
import { CanonicalDataShapeKinds } from "./CanonicalDataShapes";
import { PipelineStageIds, type PipelineStageId } from "./PipelineStageDomain";

export const PipelineExecutionStatusKinds = Object.freeze({
  pending: "pending",
  running: "running",
  complete: "complete",
  failed: "failed",
} as const);

export type PipelineExecutionStatus =
  typeof PipelineExecutionStatusKinds[keyof typeof PipelineExecutionStatusKinds];

export interface InspectionSchemaField {
  readonly name: string;
  readonly valueType?: string;
}

export interface InspectionMetadata {
  readonly rowCount?: number;
  readonly itemCount?: number;
  readonly schema?: ReadonlyArray<InspectionSchemaField>;
  readonly summaryStats?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface RecordsPreviewData {
  readonly kind: "records";
  readonly items: ReadonlyArray<CanonicalRecordItem>;
  readonly truncated: boolean;
  readonly totalCount: number;
}

export interface TablePreviewData {
  readonly kind: "table";
  readonly columns: ReadonlyArray<CanonicalTableColumn>;
  readonly rows: ReadonlyArray<CanonicalTableRow>;
  readonly truncated: boolean;
  readonly totalCount: number;
}

export interface TextItemsPreviewData {
  readonly kind: "text-items";
  readonly items: ReadonlyArray<CanonicalTextItem>;
  readonly truncated: boolean;
  readonly totalCount: number;
}

export interface ImageMetadataPreviewData {
  readonly kind: "image-metadata-records";
  readonly items: ReadonlyArray<CanonicalImageStructuredItem>;
  readonly truncated: boolean;
  readonly totalCount: number;
}

export type PipelinePreviewData =
  | RecordsPreviewData
  | TablePreviewData
  | TextItemsPreviewData
  | ImageMetadataPreviewData;

export interface PipelinePreviewEnvelope {
  readonly version: "1.0.0";
  readonly kind: PipelinePreviewData["kind"];
  readonly totalCount: number;
  readonly truncated: boolean;
  readonly payload: PipelinePreviewData;
}

export interface AssetInspectionResult {
  readonly stageId: PipelineStageId;
  readonly assetId: string;
  readonly assetNodeId: string;
  readonly status: PipelineExecutionStatus;
  readonly preview?: PipelinePreviewEnvelope;
  readonly previewData?: PipelinePreviewData;
  readonly metadata: InspectionMetadata;
}

export interface StageInspectionResult {
  readonly stageId: PipelineStageId;
  readonly status: PipelineExecutionStatus;
  readonly preview?: PipelinePreviewEnvelope;
  readonly previewData?: PipelinePreviewData;
  readonly metadata: InspectionMetadata;
  readonly assets: ReadonlyArray<AssetInspectionResult>;
}

export interface PipelineInspectionResult {
  readonly status: PipelineExecutionStatus;
  readonly stages: ReadonlyArray<StageInspectionResult>;
  readonly assets: ReadonlyArray<AssetInspectionResult>;
}

export interface PipelineNodeInspectionMetadata {
  readonly status: PipelineExecutionStatus;
  readonly metadata: InspectionMetadata;
  readonly hasPreview: boolean;
}

const ExecutionStatusSchema = z.nativeEnum(PipelineExecutionStatusKinds);
const StageIdSchema = z.nativeEnum(PipelineStageIds);

const SchemaFieldSchema = z.object({
  name: z.string().trim().min(1),
  valueType: z.string().trim().min(1).optional(),
});

export const InspectionMetadataSchema = z.object({
  rowCount: z.number().int().min(0).optional(),
  itemCount: z.number().int().min(0).optional(),
  schema: z.array(SchemaFieldSchema).optional(),
  summaryStats: z.record(z.any()).optional(),
});

const PreviewBaseSchema = z.object({
  truncated: z.boolean(),
  totalCount: z.number().int().min(0),
});

const RecordsPreviewDataSchema = PreviewBaseSchema.extend({
  kind: z.literal(CanonicalDataShapeKinds.records),
  items: z.array(z.object({
    recordId: z.string().trim().min(1),
    fields: z.record(z.any()),
    metadata: z.record(z.any()).optional(),
  })),
});

const TablePreviewDataSchema = PreviewBaseSchema.extend({
  kind: z.literal(CanonicalDataShapeKinds.table),
  columns: z.array(z.object({
    columnId: z.string().trim().min(1),
    label: z.string().trim().min(1),
    valueType: z.string().trim().min(1),
  })),
  rows: z.array(z.object({
    rowId: z.string().trim().min(1),
    cells: z.record(z.any()),
    sourceRecordId: z.string().trim().min(1).optional(),
    metadata: z.record(z.any()).optional(),
  })),
});

const TextItemsPreviewDataSchema = PreviewBaseSchema.extend({
  kind: z.literal(CanonicalDataShapeKinds.textItems),
  items: z.array(z.object({
    itemId: z.string().trim().min(1),
    text: z.string(),
    sourceDocumentId: z.string().trim().min(1).optional(),
    startOffset: z.number().int().min(0).optional(),
    endOffset: z.number().int().min(0).optional(),
    metadata: z.record(z.any()).optional(),
  })),
});

const ImageMetadataPreviewDataSchema = PreviewBaseSchema.extend({
  kind: z.literal(CanonicalDataShapeKinds.imageMetadataRecords),
  items: z.array(z.object({
    itemId: z.string().trim().min(1),
    imageId: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    boundingBox: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    attributes: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  })),
});

export const PipelinePreviewDataSchema = z.discriminatedUnion("kind", [
  RecordsPreviewDataSchema,
  TablePreviewDataSchema,
  TextItemsPreviewDataSchema,
  ImageMetadataPreviewDataSchema,
]);

export const PipelinePreviewEnvelopeSchema = z.object({
  version: z.literal("1.0.0"),
  kind: z.enum([
    CanonicalDataShapeKinds.records,
    CanonicalDataShapeKinds.table,
    CanonicalDataShapeKinds.textItems,
    CanonicalDataShapeKinds.imageMetadataRecords,
  ]),
  totalCount: z.number().int().min(0),
  truncated: z.boolean(),
  payload: PipelinePreviewDataSchema,
});

export const PipelineNodeInspectionMetadataSchema = z.object({
  status: ExecutionStatusSchema,
  metadata: InspectionMetadataSchema,
  hasPreview: z.boolean(),
});

export const AssetInspectionResultSchema = z.object({
  stageId: StageIdSchema,
  assetId: z.string().trim().min(1),
  assetNodeId: z.string().trim().min(1),
  status: ExecutionStatusSchema,
  preview: PipelinePreviewEnvelopeSchema.optional(),
  previewData: PipelinePreviewDataSchema.optional(),
  metadata: InspectionMetadataSchema,
});

export const StageInspectionResultSchema = z.object({
  stageId: StageIdSchema,
  status: ExecutionStatusSchema,
  preview: PipelinePreviewEnvelopeSchema.optional(),
  previewData: PipelinePreviewDataSchema.optional(),
  metadata: InspectionMetadataSchema,
  assets: z.array(AssetInspectionResultSchema),
});

export const PipelineInspectionResultSchema = z.object({
  status: ExecutionStatusSchema,
  stages: z.array(StageInspectionResultSchema),
  assets: z.array(AssetInspectionResultSchema),
});

export function validatePipelineInspectionResult(
  value: PipelineInspectionResult,
): PipelineInspectionResult {
  return PipelineInspectionResultSchema.parse(value) as PipelineInspectionResult;
}
