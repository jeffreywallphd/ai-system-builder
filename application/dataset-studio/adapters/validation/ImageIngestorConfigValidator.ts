import { z } from "zod";

export const ImageIngestorConfigSchema = z.object({
  extractExif: z.boolean().default(true),
  generatePreviewMetadata: z.boolean().default(true),
  normalizeOrientation: z.boolean().default(true),
  includeFileStats: z.boolean().default(true),
  tags: z.array(z.string().trim().min(1)).max(64).default([]),
  annotations: z.object({
    caption: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
    labels: z.array(z.string().trim().min(1).max(100)).max(32).default([]),
    region: z.object({
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().positive(),
      height: z.number().positive(),
      coordinateSpace: z.literal("pixel").optional(),
      referenceId: z.string().trim().min(1).max(100).optional(),
    }).optional(),
  }).optional(),
});

export type ImageIngestorConfig = z.output<typeof ImageIngestorConfigSchema>;

export function parseImageIngestorConfig(input: unknown): ImageIngestorConfig {
  return ImageIngestorConfigSchema.parse(input ?? {});
}

export function safeParseImageIngestorConfig(input: unknown): ReturnType<typeof ImageIngestorConfigSchema.safeParse> {
  return ImageIngestorConfigSchema.safeParse(input ?? {});
}
