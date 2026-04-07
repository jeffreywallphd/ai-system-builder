import {
  ConversionRequiredError,
  DisallowedMimeTypeError,
  FileTooLargeError,
  MalformedFileIngestionRequestError,
  type FileDescriptor,
  type FileIngestionPolicy,
  type FileIngestionRequest,
  type FileIngestionWarning,
  type NormalizedDocumentContent,
  type FileProvenance,
  type ConversionMetadata,
  UnsupportedFileTypeError,
} from "./interfaces/IFileIngestion";

const EXTENSION_TO_MIME_TYPES = Object.freeze({
  ".md": ["text/markdown", "text/x-markdown"],
  ".markdown": ["text/markdown", "text/x-markdown"],
  ".txt": ["text/plain"],
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
} as const satisfies Readonly<Record<string, ReadonlyArray<string>>>);

function freezeWarnings(warnings: ReadonlyArray<FileIngestionWarning>): ReadonlyArray<FileIngestionWarning> {
  return Object.freeze([...warnings].map((warning) => Object.freeze({ ...warning })));
}

function normalizeExtension(extension: string | undefined, fileName: string): string | undefined {
  const declared = extension?.trim().toLowerCase();
  if (declared) {
    return declared.startsWith(".") ? declared : `.${declared}`;
  }

  const match = fileName.trim().toLowerCase().match(/(\.[a-z0-9]+)$/i);
  return match?.[1];
}

function normalizeMimeType(mimeType: string | undefined): string | undefined {
  return mimeType?.split(";")[0]?.trim().toLowerCase() || undefined;
}

function normalizeTextContent(content: string | Uint8Array): string {
  if (typeof content === "string") {
    return content.replace(/\r\n/g, "\n");
  }

  return new TextDecoder().decode(content).replace(/\r\n/g, "\n");
}

function determineSourceFormat(extension: string | undefined, mimeType: string | undefined): string {
  if (extension === ".md" || extension === ".markdown" || mimeType === "text/markdown" || mimeType === "text/x-markdown") {
    return "markdown";
  }

  if (extension === ".txt" || mimeType === "text/plain") {
    return "text";
  }

  if (extension === ".pdf") {
    return "pdf";
  }

  if (extension === ".docx") {
    return "docx";
  }

  if (extension === ".pptx") {
    return "pptx";
  }

  return extension?.replace(/^\./, "") || mimeType || "unknown";
}

export interface EvaluatedIngestionRequest {
  readonly descriptor: FileDescriptor;
  readonly warnings: ReadonlyArray<FileIngestionWarning>;
  readonly sourceFormat: string;
  readonly requiresConversion: boolean;
}

export class FileIngestionPolicyService {
  public normalizeRequest(request: FileIngestionRequest): FileIngestionRequest {
    const name = request.file.name?.trim();
    if (!name) {
      throw new MalformedFileIngestionRequestError("File ingestion requires a file name.");
    }

    if (request.file.sizeInBytes < 0) {
      throw new MalformedFileIngestionRequestError("File size must be zero or greater.", {
        sizeInBytes: request.file.sizeInBytes,
      });
    }

    return Object.freeze({
      ...request,
      file: Object.freeze({
        ...request.file,
        name,
        extension: normalizeExtension(request.file.extension, name),
        mimeType: normalizeMimeType(request.file.mimeType),
      }),
      provenance: Object.freeze({
        ...request.provenance,
        capturedAt: new Date(request.provenance.capturedAt),
      }),
    });
  }

  public evaluateRequest(request: FileIngestionRequest, policy: FileIngestionPolicy): EvaluatedIngestionRequest {
    const normalizedRequest = this.normalizeRequest(request);
    const descriptor = normalizedRequest.file;
    const warnings: FileIngestionWarning[] = [];

    if (descriptor.sizeInBytes > policy.maxFileSizeBytes) {
      throw new FileTooLargeError(`File '${descriptor.name}' exceeds the maximum allowed size.`, {
        actualSizeInBytes: descriptor.sizeInBytes,
        maxFileSizeBytes: policy.maxFileSizeBytes,
      });
    }

    if (!descriptor.extension || !policy.acceptedExtensions.map((value) => value.toLowerCase()).includes(descriptor.extension)) {
      throw new UnsupportedFileTypeError(`File '${descriptor.name}' is not an accepted file type.`, {
        extension: descriptor.extension,
        acceptedExtensions: policy.acceptedExtensions,
      });
    }

    if (!descriptor.mimeType) {
      if (!(policy.allowMissingMimeType ?? true)) {
        throw new DisallowedMimeTypeError(`File '${descriptor.name}' is missing a required MIME type.`, {
          acceptedMimeTypes: policy.acceptedMimeTypes,
        });
      }

      warnings.push({
        code: "missing_content_type",
        message: `File '${descriptor.name}' did not declare a MIME type; policy evaluation used the extension.`,
      });
    } else if (policy.acceptedMimeTypes.length > 0 && !policy.acceptedMimeTypes.map((value) => value.toLowerCase()).includes(descriptor.mimeType)) {
      throw new DisallowedMimeTypeError(`File '${descriptor.name}' declared a disallowed MIME type.`, {
        mimeType: descriptor.mimeType,
        acceptedMimeTypes: policy.acceptedMimeTypes,
      });
    }

    if ((policy.mismatchWarningsEnabled ?? true) && descriptor.extension && descriptor.mimeType) {
      const expectedMimeTypes = EXTENSION_TO_MIME_TYPES[descriptor.extension as keyof typeof EXTENSION_TO_MIME_TYPES];
      if (expectedMimeTypes && !expectedMimeTypes.includes(descriptor.mimeType)) {
        warnings.push({
          code: "filename_extension_mismatch",
          message: `File '${descriptor.name}' extension '${descriptor.extension}' does not match MIME type '${descriptor.mimeType}'.`,
          details: {
            extension: descriptor.extension,
            mimeType: descriptor.mimeType,
            expectedMimeTypes,
          },
        });
      }
    }

    const sourceFormat = determineSourceFormat(descriptor.extension, descriptor.mimeType);
    const passThroughExtensions = policy.conversion.passThroughExtensions.map((value) => value.toLowerCase());
    const passThroughMimeTypes = policy.conversion.passThroughMimeTypes.map((value) => value.toLowerCase());
    const isPassThrough = Boolean(
      (descriptor.extension && passThroughExtensions.includes(descriptor.extension)) ||
      (descriptor.mimeType && passThroughMimeTypes.includes(descriptor.mimeType))
    );

    if (!isPassThrough && policy.conversion.mode === "forbidden") {
      throw new ConversionRequiredError(`File '${descriptor.name}' would require conversion, but the profile forbids conversion.`, {
        extension: descriptor.extension,
        mimeType: descriptor.mimeType,
      });
    }

    if (!isPassThrough && policy.conversion.mode === "required" && !policy.conversion.allowedOutputFormats.includes("markdown")) {
      throw new ConversionRequiredError(`File '${descriptor.name}' requires conversion, but markdown output is not allowed.`, {
        allowedOutputFormats: policy.conversion.allowedOutputFormats,
      });
    }

    return Object.freeze({
      descriptor,
      warnings: freezeWarnings(warnings),
      sourceFormat,
      requiresConversion: !isPassThrough,
    });
  }

  public buildPassThroughDocument(params: {
    readonly descriptor: FileDescriptor;
    readonly provenance: FileProvenance;
    readonly sourceFormat: string;
    readonly content: string | Uint8Array;
    readonly warnings?: ReadonlyArray<FileIngestionWarning>;
  }): NormalizedDocumentContent {
    const markdown = normalizeTextContent(params.content);
    const warnings = freezeWarnings([
      ...(params.warnings ?? []),
      {
        code: "pass_through_normalization",
        message: `File '${params.descriptor.name}' was normalized without converter invocation.`,
      },
    ]);
    const conversion: ConversionMetadata = Object.freeze({
      strategy: "pass_through",
      converterId: "native-pass-through",
      declaredSourceFormat: params.sourceFormat,
      detectedSourceFormat: params.sourceFormat,
    });

    return Object.freeze({
      markdown,
      sourceFormat: params.sourceFormat,
      outputFormat: "markdown",
      file: params.descriptor,
      conversion,
      warnings,
      provenance: Object.freeze({ ...params.provenance, capturedAt: new Date(params.provenance.capturedAt) }),
    });
  }
}
