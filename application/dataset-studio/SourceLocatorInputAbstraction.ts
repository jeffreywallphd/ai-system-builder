/// <reference types="node" />
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";

export const SourceInputKinds = Object.freeze({
  localFile: "local-file",
  localFiles: "local-files",
  localDirectory: "local-directory",
  remoteFile: "remote-file",
} as const);

export type SourceInputKind = typeof SourceInputKinds[keyof typeof SourceInputKinds];

export const SourceDescriptorKinds = Object.freeze({
  localFile: "local-file",
  remoteFile: "remote-file",
} as const);

export type SourceDescriptorKind = typeof SourceDescriptorKinds[keyof typeof SourceDescriptorKinds];

export const SourceLocatorIssueCodes = Object.freeze({
  invalidConfig: "invalid_config",
  invalidReference: "invalid_reference",
  unreadablePath: "unreadable_path",
  unsupportedKind: "unsupported_kind",
  unsupportedExtension: "unsupported_extension",
} as const);

export type SourceLocatorIssueCode = typeof SourceLocatorIssueCodes[keyof typeof SourceLocatorIssueCodes];

export interface SourceLocatorIssue {
  readonly code: SourceLocatorIssueCode;
  readonly message: string;
  readonly reference?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class SourceLocatorInputError extends Error {
  public readonly issues: ReadonlyArray<SourceLocatorIssue>;

  constructor(message: string, issues: ReadonlyArray<SourceLocatorIssue>) {
    super(message);
    this.name = "SourceLocatorInputError";
    this.issues = issues;
  }
}

export interface SourceDescriptor {
  readonly sourceId: string;
  readonly kind: SourceDescriptorKind;
  readonly originalReference: string;
  readonly normalizedReference: string;
  readonly sourceType: "file";
  readonly displayName: string;
  readonly extension?: string;
  readonly mediaType?: string;
  readonly sizeInBytes?: number;
  readonly groupId?: string;
}

export interface SourceInspectionPreview {
  readonly totalMatched: number;
  readonly previewedCount: number;
  readonly extensionSummary: Readonly<Record<string, number>>;
  readonly items: ReadonlyArray<SourceDescriptor>;
  readonly issues: ReadonlyArray<SourceLocatorIssue>;
}

export interface SourceLocatorResolutionResult {
  readonly descriptors: ReadonlyArray<SourceDescriptor>;
  readonly issues: ReadonlyArray<SourceLocatorIssue>;
  readonly extensionSummary: Readonly<Record<string, number>>;
}

const SupportedExtensionSchema = z
  .string()
  .min(1)
  .transform((value) => {
    const trimmed = value.trim().toLowerCase();
    return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
  });

export const LocalFileSourceInputSchema = z.object({
  kind: z.literal(SourceInputKinds.localFile),
  path: z.string().min(1),
  groupId: z.string().trim().min(1).optional(),
});

export const LocalFilesSourceInputSchema = z.object({
  kind: z.literal(SourceInputKinds.localFiles),
  paths: z.array(z.string().min(1)).min(1),
  groupId: z.string().trim().min(1).optional(),
});

export const LocalDirectorySourceInputSchema = z.object({
  kind: z.literal(SourceInputKinds.localDirectory),
  path: z.string().min(1),
  patterns: z.array(z.string().min(1)).optional(),
  groupId: z.string().trim().min(1).optional(),
});

export const RemoteFileSourceInputSchema = z.object({
  kind: z.literal(SourceInputKinds.remoteFile),
  reference: z.string().min(1),
  displayName: z.string().trim().min(1).optional(),
  extension: SupportedExtensionSchema.optional(),
  mediaType: z.string().trim().min(1).optional(),
  groupId: z.string().trim().min(1).optional(),
});

export const SourceLocatorInputSchema = z.discriminatedUnion("kind", [
  LocalFileSourceInputSchema,
  LocalFilesSourceInputSchema,
  LocalDirectorySourceInputSchema,
  RemoteFileSourceInputSchema,
]);

export const SourceLocatorConfigSchema = z.object({
  supportedExtensions: z.array(SupportedExtensionSchema).optional(),
  includeHidden: z.boolean().default(false),
  followSymbolicLinks: z.boolean().default(false),
  maxFiles: z.number().int().positive().optional(),
});

export type SourceLocatorInput = z.output<typeof SourceLocatorInputSchema>;
export type SourceLocatorConfig = z.output<typeof SourceLocatorConfigSchema>;

export interface SourceLocatorRequest {
  readonly input: SourceLocatorInput;
  readonly config?: Partial<SourceLocatorConfig>;
}

type FastGlobMatcher = (
  patterns: ReadonlyArray<string>,
  options: {
    readonly cwd: string;
    readonly onlyFiles: true;
    readonly absolute: true;
    readonly unique: true;
    readonly dot: boolean;
    readonly followSymbolicLinks: boolean;
  },
) => Promise<ReadonlyArray<string>>;

async function resolveFastGlobMatcher(): Promise<FastGlobMatcher> {
  const module = await import("fast-glob");
  const candidate = "default" in module ? module.default : module;
  if (typeof candidate !== "function") {
    throw new Error("Unable to resolve fast-glob matcher.");
  }
  return candidate as FastGlobMatcher;
}

export interface ISourceDirectoryScanner {
  scan(
    directoryPath: string,
    patterns: ReadonlyArray<string>,
    options: {
      readonly includeHidden: boolean;
      readonly followSymbolicLinks: boolean;
    },
  ): Promise<ReadonlyArray<string>>;
}

class FastGlobSourceDirectoryScanner implements ISourceDirectoryScanner {
  public async scan(
    directoryPath: string,
    patterns: ReadonlyArray<string>,
    options: {
      readonly includeHidden: boolean;
      readonly followSymbolicLinks: boolean;
    },
  ): Promise<ReadonlyArray<string>> {
    const scanDirectory = await resolveFastGlobMatcher();
    return scanDirectory(patterns, {
      cwd: directoryPath,
      onlyFiles: true,
      absolute: true,
      unique: true,
      dot: options.includeHidden,
      followSymbolicLinks: options.followSymbolicLinks,
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function inferExtension(fileNameOrPath: string): string | undefined {
  const normalized = fileNameOrPath.trim().toLowerCase();
  const extension = path.extname(normalized);
  return extension || undefined;
}

function toMediaType(extension?: string): string | undefined {
  switch (extension) {
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return undefined;
  }
}

function createSourceId(reference: string, groupId?: string): string {
  const hash = createHash("sha1").update(`${groupId ?? ""}:${reference}`).digest("hex").slice(0, 16);
  return `src_${hash}`;
}

function summarizeExtensions(descriptors: ReadonlyArray<SourceDescriptor>): Readonly<Record<string, number>> {
  const summary: Record<string, number> = {};
  for (const descriptor of descriptors) {
    const extension = descriptor.extension ?? "unknown";
    summary[extension] = (summary[extension] ?? 0) + 1;
  }
  return Object.freeze(summary);
}

function shouldIncludeExtension(extension: string | undefined, config: SourceLocatorConfig): boolean {
  if (!config.supportedExtensions || config.supportedExtensions.length === 0) {
    return true;
  }
  if (!extension) {
    return false;
  }
  return config.supportedExtensions.includes(extension);
}

export class SourceLocatorInputAbstraction {
  private readonly directoryScanner: ISourceDirectoryScanner;

  constructor(options?: { readonly directoryScanner?: ISourceDirectoryScanner }) {
    this.directoryScanner = options?.directoryScanner ?? new FastGlobSourceDirectoryScanner();
  }

  public async resolve(request: SourceLocatorRequest): Promise<SourceLocatorResolutionResult> {
    const parsedInput = SourceLocatorInputSchema.safeParse(request.input);
    const parsedConfig = SourceLocatorConfigSchema.safeParse(request.config ?? {});
    if (!parsedInput.success || !parsedConfig.success) {
      const issues: SourceLocatorIssue[] = [];
      for (const issue of parsedInput.success ? [] : parsedInput.error.issues) {
        issues.push(Object.freeze({
          code: SourceLocatorIssueCodes.invalidConfig,
          message: issue.message,
          reference: "input",
          details: Object.freeze({ path: issue.path.join(".") }),
        }));
      }
      for (const issue of parsedConfig.success ? [] : parsedConfig.error.issues) {
        issues.push(Object.freeze({
          code: SourceLocatorIssueCodes.invalidConfig,
          message: issue.message,
          reference: "config",
          details: Object.freeze({ path: issue.path.join(".") }),
        }));
      }
      throw new SourceLocatorInputError("Source locator request validation failed.", Object.freeze(issues));
    }

    const input = parsedInput.data;
    const config = parsedConfig.data;
    const issues: SourceLocatorIssue[] = [];
    const descriptors: SourceDescriptor[] = [];

    if (input.kind === SourceInputKinds.localFile) {
      const descriptor = await this.resolveLocalFile(input.path, input.groupId, config, issues);
      if (descriptor) {
        descriptors.push(descriptor);
      }
    } else if (input.kind === SourceInputKinds.localFiles) {
      for (const filePath of input.paths) {
        const descriptor = await this.resolveLocalFile(filePath, input.groupId, config, issues);
        if (descriptor) {
          descriptors.push(descriptor);
        }
        if (config.maxFiles && descriptors.length >= config.maxFiles) {
          break;
        }
      }
    } else if (input.kind === SourceInputKinds.localDirectory) {
      const fromDirectory = await this.resolveDirectory(input.path, input.patterns, input.groupId, config, issues);
      descriptors.push(...fromDirectory);
    } else if (input.kind === SourceInputKinds.remoteFile) {
      const descriptor = this.resolveRemoteFile(input, config, issues);
      if (descriptor) {
        descriptors.push(descriptor);
      }
    } else {
      issues.push(Object.freeze({
        code: SourceLocatorIssueCodes.unsupportedKind,
        message: `Unsupported source input kind '${(input as { readonly kind?: string }).kind ?? "unknown"}'.`,
      }));
    }

    const bounded = config.maxFiles ? descriptors.slice(0, config.maxFiles) : descriptors;
    return Object.freeze({
      descriptors: Object.freeze(bounded),
      issues: Object.freeze(issues),
      extensionSummary: summarizeExtensions(bounded),
    });
  }

  public async inspect(
    request: SourceLocatorRequest,
    previewLimit: number = 25,
  ): Promise<SourceInspectionPreview> {
    const result = await this.resolve(request);
    const boundedLimit = Math.max(1, Math.min(100, previewLimit));
    const items = result.descriptors.slice(0, boundedLimit);
    return Object.freeze({
      totalMatched: result.descriptors.length,
      previewedCount: items.length,
      extensionSummary: result.extensionSummary,
      items: Object.freeze(items),
      issues: result.issues,
    });
  }

  private async resolveLocalFile(
    filePath: string,
    groupId: string | undefined,
    config: SourceLocatorConfig,
    issues: SourceLocatorIssue[],
  ): Promise<SourceDescriptor | undefined> {
    const normalizedPath = path.resolve(filePath.trim());
    try {
      const stats = await fs.stat(normalizedPath);
      if (!stats.isFile()) {
        issues.push(Object.freeze({
          code: SourceLocatorIssueCodes.invalidReference,
          message: "Source reference must resolve to a file.",
          reference: normalizedPath,
        }));
        return undefined;
      }

      const extension = inferExtension(normalizedPath);
      if (!shouldIncludeExtension(extension, config)) {
        issues.push(Object.freeze({
          code: SourceLocatorIssueCodes.unsupportedExtension,
          message: `Source extension '${extension ?? "unknown"}' is not supported by this request.`,
          reference: normalizedPath,
        }));
        return undefined;
      }

      return Object.freeze({
        sourceId: createSourceId(normalizedPath, groupId),
        kind: SourceDescriptorKinds.localFile,
        originalReference: filePath,
        normalizedReference: normalizedPath,
        sourceType: "file" as const,
        displayName: path.basename(normalizedPath),
        extension,
        mediaType: toMediaType(extension),
        sizeInBytes: stats.size,
        groupId: normalizeOptional(groupId),
      });
    } catch (error) {
      issues.push(Object.freeze({
        code: SourceLocatorIssueCodes.unreadablePath,
        message: `Unable to read source path '${normalizedPath}'.`,
        reference: normalizedPath,
        details: Object.freeze({
          cause: error instanceof Error ? error.message : String(error),
        }),
      }));
      return undefined;
    }
  }

  private async resolveDirectory(
    directoryPath: string,
    patterns: ReadonlyArray<string> | undefined,
    groupId: string | undefined,
    config: SourceLocatorConfig,
    issues: SourceLocatorIssue[],
  ): Promise<ReadonlyArray<SourceDescriptor>> {
    const normalizedDirectory = path.resolve(directoryPath.trim());
    try {
      const stats = await fs.stat(normalizedDirectory);
      if (!stats.isDirectory()) {
        issues.push(Object.freeze({
          code: SourceLocatorIssueCodes.invalidReference,
          message: "Directory source input requires a directory path.",
          reference: normalizedDirectory,
        }));
        return Object.freeze([]);
      }
    } catch (error) {
      issues.push(Object.freeze({
        code: SourceLocatorIssueCodes.unreadablePath,
        message: `Unable to inspect directory '${normalizedDirectory}'.`,
        reference: normalizedDirectory,
        details: Object.freeze({
          cause: error instanceof Error ? error.message : String(error),
        }),
      }));
      return Object.freeze([]);
    }

    const scanPatterns = patterns && patterns.length > 0 ? patterns : ["**/*"];
    let matches: ReadonlyArray<string>;
    try {
      matches = await this.directoryScanner.scan(normalizedDirectory, scanPatterns, {
        includeHidden: config.includeHidden,
        followSymbolicLinks: config.followSymbolicLinks,
      });
    } catch (error) {
      issues.push(Object.freeze({
        code: SourceLocatorIssueCodes.unreadablePath,
        message: `Unable to enumerate directory '${normalizedDirectory}'.`,
        reference: normalizedDirectory,
        details: Object.freeze({
          cause: error instanceof Error ? error.message : String(error),
        }),
      }));
      return Object.freeze([]);
    }

    const descriptors: SourceDescriptor[] = [];
    for (const absoluteMatch of matches) {
      const descriptor = await this.resolveLocalFile(absoluteMatch, groupId, config, issues);
      if (descriptor) {
        descriptors.push(descriptor);
      }
      if (config.maxFiles && descriptors.length >= config.maxFiles) {
        break;
      }
    }
    return Object.freeze(descriptors);
  }

  private resolveRemoteFile(
    input: z.output<typeof RemoteFileSourceInputSchema>,
    config: SourceLocatorConfig,
    issues: SourceLocatorIssue[],
  ): SourceDescriptor | undefined {
    const reference = input.reference.trim();
    const extension = input.extension ?? inferExtension(reference);
    if (!shouldIncludeExtension(extension, config)) {
      issues.push(Object.freeze({
        code: SourceLocatorIssueCodes.unsupportedExtension,
        message: `Source extension '${extension ?? "unknown"}' is not supported by this request.`,
        reference,
      }));
      return undefined;
    }

    return Object.freeze({
      sourceId: createSourceId(reference, input.groupId),
      kind: SourceDescriptorKinds.remoteFile,
      originalReference: input.reference,
      normalizedReference: reference,
      sourceType: "file" as const,
      displayName: input.displayName ?? (path.basename(reference) || reference),
      extension,
      mediaType: input.mediaType ?? toMediaType(extension),
      groupId: normalizeOptional(input.groupId),
    });
  }
}
