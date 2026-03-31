import {
  DataConverterDiagnosticSeverities,
  DataSourceReferenceKinds,
  createDataConverterDiagnostic,
  resolveFormatFromReference,
  type DataConverterDiagnostic,
  type DataConverterOperationContext,
  type DataSourceReference,
  type ResolvedDataSource,
} from "./DataConverterContracts";

export const DataSourceLocatorErrorCodes = Object.freeze({
  invalidReference: "invalid_reference",
  unsupportedReference: "unsupported_reference",
  sourceUnavailable: "source_unavailable",
} as const);

export type DataSourceLocatorErrorCode = typeof DataSourceLocatorErrorCodes[keyof typeof DataSourceLocatorErrorCodes];

export class DataSourceLocatorError extends Error {
  public readonly code: DataSourceLocatorErrorCode;
  public readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;

  constructor(
    code: DataSourceLocatorErrorCode,
    message: string,
    diagnostics: ReadonlyArray<DataConverterDiagnostic>,
  ) {
    super(message);
    this.name = "DataSourceLocatorError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export interface DataSourceLocatorResolutionRequest {
  readonly source: DataSourceReference;
  readonly context?: DataConverterOperationContext;
}

export interface IDataSourcePayloadLoader {
  loadLocalFile(path: string): Promise<string | Uint8Array>;
  loadUrl(url: string): Promise<string | Uint8Array>;
}

export interface IDataSourceLocator {
  resolve(request: DataSourceLocatorResolutionRequest): Promise<ResolvedDataSource>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toFileName(pathOrUrl: string): string | undefined {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  const slashIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const tail = slashIndex >= 0 ? trimmed.slice(slashIndex + 1) : trimmed;
  const queryStart = tail.indexOf("?");
  const clean = queryStart >= 0 ? tail.slice(0, queryStart) : tail;
  return clean || undefined;
}

function toDiagnostics(
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ReadonlyArray<DataConverterDiagnostic> {
  return Object.freeze([
    createDataConverterDiagnostic({
      code,
      severity: DataConverterDiagnosticSeverities.error,
      message,
      details,
    }),
  ]);
}

function freezeResolved(input: Omit<ResolvedDataSource, "diagnostics"> & {
  readonly diagnostics?: ReadonlyArray<DataConverterDiagnostic>;
}): ResolvedDataSource {
  return Object.freeze({
    ...input,
    diagnostics: input.diagnostics ?? Object.freeze([]),
  });
}

export class DefaultDataSourceLocator implements IDataSourceLocator {
  constructor(private readonly payloadLoader?: IDataSourcePayloadLoader) {}

  public async resolve(request: DataSourceLocatorResolutionRequest): Promise<ResolvedDataSource> {
    const source = request.source;
    if (source.kind === DataSourceReferenceKinds.inMemory) {
      return freezeResolved({
        kind: source.kind,
        reference: "in-memory",
        payload: source.payload,
        fileName: normalizeOptional(source.fileName),
        contentType: normalizeOptional(source.contentType),
        formatHint: resolveFormatFromReference(source),
        sourceAssetId: normalizeOptional(source.sourceAssetId),
        sourceVersionId: normalizeOptional(source.sourceVersionId),
      });
    }

    if (source.kind === DataSourceReferenceKinds.localFile) {
      const path = normalizeOptional(source.path);
      if (!path) {
        const diagnostics = toDiagnostics(
          DataSourceLocatorErrorCodes.invalidReference,
          "Local file source references require a non-empty path.",
        );
        throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.invalidReference, diagnostics[0].message, diagnostics);
      }

      const payload = source.payload ?? await this.loadFromLocalPath(path);
      return freezeResolved({
        kind: source.kind,
        reference: path,
        payload,
        fileName: normalizeOptional(source.fileName) ?? toFileName(path),
        contentType: normalizeOptional(source.contentType),
        formatHint: resolveFormatFromReference(source),
        sourceAssetId: normalizeOptional(source.sourceAssetId),
        sourceVersionId: normalizeOptional(source.sourceVersionId),
      });
    }

    if (source.kind === DataSourceReferenceKinds.url) {
      const url = normalizeOptional(source.url);
      if (!url) {
        const diagnostics = toDiagnostics(
          DataSourceLocatorErrorCodes.invalidReference,
          "URL sources require a non-empty url.",
        );
        throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.invalidReference, diagnostics[0].message, diagnostics);
      }

      const payload = source.payload ?? await this.loadFromUrl(url);
      return freezeResolved({
        kind: source.kind,
        reference: url,
        payload,
        fileName: normalizeOptional(source.fileName) ?? toFileName(url),
        contentType: normalizeOptional(source.contentType),
        formatHint: resolveFormatFromReference(source),
        sourceAssetId: normalizeOptional(source.sourceAssetId),
        sourceVersionId: normalizeOptional(source.sourceVersionId),
      });
    }

    const unknown = source as { readonly kind?: string };
    const diagnostics = toDiagnostics(
      DataSourceLocatorErrorCodes.unsupportedReference,
      `Unsupported data source kind '${unknown.kind ?? "unknown"}'.`,
    );
    throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.unsupportedReference, diagnostics[0].message, diagnostics);
  }

  private async loadFromLocalPath(path: string): Promise<string | Uint8Array> {
    if (!this.payloadLoader) {
      const diagnostics = toDiagnostics(
        DataSourceLocatorErrorCodes.sourceUnavailable,
        `Local file source '${path}' requires a payload loader when inline payload is not provided.`,
        { path },
      );
      throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.sourceUnavailable, diagnostics[0].message, diagnostics);
    }

    try {
      return await this.payloadLoader.loadLocalFile(path);
    } catch (error) {
      const diagnostics = toDiagnostics(
        DataSourceLocatorErrorCodes.sourceUnavailable,
        `Unable to resolve local file source '${path}'.`,
        { path, cause: error instanceof Error ? error.message : String(error) },
      );
      throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.sourceUnavailable, diagnostics[0].message, diagnostics);
    }
  }

  private async loadFromUrl(url: string): Promise<string | Uint8Array> {
    if (!this.payloadLoader) {
      const diagnostics = toDiagnostics(
        DataSourceLocatorErrorCodes.sourceUnavailable,
        `URL source '${url}' requires a payload loader when inline payload is not provided.`,
        { url },
      );
      throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.sourceUnavailable, diagnostics[0].message, diagnostics);
    }

    try {
      return await this.payloadLoader.loadUrl(url);
    } catch (error) {
      const diagnostics = toDiagnostics(
        DataSourceLocatorErrorCodes.sourceUnavailable,
        `Unable to resolve URL source '${url}'.`,
        { url, cause: error instanceof Error ? error.message : String(error) },
      );
      throw new DataSourceLocatorError(DataSourceLocatorErrorCodes.sourceUnavailable, diagnostics[0].message, diagnostics);
    }
  }
}
