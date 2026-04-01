import { useEffect, useMemo, useState } from "react";
import type { DataPreviewModel } from "../../../application/data-studio/DataPreviewEngine";
import { BatchIngestionAssetId, BatchIngestionFramework, BatchIngestionStrategyKinds, BatchIngestorKinds } from "../../../application/dataset-studio/BatchIngestionFramework";
import { resolveDataAssetConfigDefaults } from "../../../application/dataset-studio/DataAssetConfiguration";
import { type DataAssetExecutionResult, DefaultDataAssetExecutionFramework } from "../../../application/dataset-studio/DataAssetExecutionFramework";
import type { DataAssetRegistryEntry } from "../../../application/dataset-studio/DataAssetRegistry";
import { DataSourceReferenceKinds } from "../../../application/dataset-studio/DataConverterContracts";
import {
  getDataStudioAssetRegistry,
  IngestionCatalogVisibilityModes,
  listIngestionDataAssets,
} from "../../../application/dataset-studio/DataStudioAssetRegistryCatalog";
import {
  DataStudioValidationSections,
  hasErrorIssues,
  validateDataAssetConfigValues,
  type DataStudioValidationIssue,
} from "../../../application/dataset-studio/DataStudioValidation";
import { CsvIngestorAsset } from "../../../application/dataset-studio/CsvIngestorAsset";
import { DocumentPdfIngestorAsset, toDocumentPdfIngestorConfig } from "../../../application/dataset-studio/DocumentPdfIngestorAsset";
import { type IngestionIssue } from "../../../application/dataset-studio/IngestionContracts";
import { ImageIngestorAsset, toImageIngestorConfig } from "../../../application/dataset-studio/ImageIngestorAsset";
import { JsonIngestorAsset } from "../../../application/dataset-studio/JsonIngestorAsset";
import { resolveUnifiedIngestionConfiguration } from "../../../application/dataset-studio/UnifiedIngestionConfiguration";
import {
  UnifiedIngestionAssetExecutionWrapper,
  UnifiedIngestionAssetId,
  type UnifiedIngestionAssetBatchExecutionResult,
} from "../../../application/dataset-studio/UnifiedIngestionAsset";
import type { UnifiedIngestionPreviewSuccess } from "../../../application/dataset-studio/UnifiedIngestionOrchestrationService";
import { SourceInputKinds } from "../../../application/dataset-studio/SourceLocatorInputAbstraction";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { UnifiedIngestionReferenceKinds } from "../../../domain/dataset-studio/UnifiedIngestionDomain";
import AssetConfigurationPanel from "./AssetConfigurationPanel";
import type { AssetConfigurationMode } from "./AssetConfigurationPanel";
import DataPreviewPanel from "./DataPreviewPanel";
import DataPreviewSurface from "./DataPreviewSurface";

export interface DatasetStudioDraftPreviewPanelProps {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
  readonly draftContent?: string;
}

type SourceMode = "in-memory" | "local-file" | "local-directory";

function resolveSourceModes(entry: DataAssetRegistryEntry | undefined): ReadonlyArray<SourceMode> {
  if (!entry) {
    return Object.freeze(["in-memory"]);
  }

  const sourceKinds = entry.descriptor.inspectability.supportedSourceKinds;
  const modes: SourceMode[] = [];
  if (sourceKinds.includes("in-memory")) {
    modes.push("in-memory");
  }
  if (sourceKinds.includes("local-file") || sourceKinds.includes("local-files")) {
    modes.push("local-file");
  }
  if (sourceKinds.includes("local-directory")) {
    modes.push("local-directory");
  }
  return Object.freeze(modes.length > 0 ? modes : ["in-memory"]);
}

function toDataValidationIssues(issues: ReadonlyArray<IngestionIssue>): ReadonlyArray<DataStudioValidationIssue> {
  return Object.freeze(issues.map((issue) => Object.freeze({
    code: issue.code,
    section: DataStudioValidationSections.executionRequest,
    severity: issue.severity,
    message: issue.message,
    path: issue.path,
    details: issue.details as Readonly<Record<string, unknown>> | undefined,
  } satisfies DataStudioValidationIssue)));
}

function toDelimiter(input: CanonicalRecordValue | undefined): "," | "\t" | ";" | "|" {
  if (input === "\t" || input === ";" || input === "|") {
    return input;
  }
  return ",";
}

function toHeader(input: CanonicalRecordValue | undefined): boolean | "auto" {
  if (input === "true" || input === true) {
    return true;
  }
  if (input === "false" || input === false) {
    return false;
  }
  return "auto";
}

function splitPatterns(value: string): ReadonlyArray<string> {
  const patterns = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return Object.freeze(patterns.length > 0 ? patterns : ["**/*"]);
}

function toExtensionFromReference(reference: string): string | undefined {
  const trimmed = reference.trim();
  if (!trimmed) {
    return undefined;
  }
  const index = trimmed.lastIndexOf(".");
  if (index <= 0 || index === trimmed.length - 1) {
    return undefined;
  }
  return trimmed.slice(index).toLowerCase();
}

function toUnifiedIngestionIssues(
  issues: ReadonlyArray<{
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }>,
): ReadonlyArray<DataStudioValidationIssue> {
  return Object.freeze(issues.map((issue) => Object.freeze({
    code: issue.code,
    section: DataStudioValidationSections.executionRequest,
    severity: issue.severity,
    message: issue.message,
    path: typeof issue.details?.path === "string" ? issue.details.path : undefined,
    details: issue.details,
  } satisfies DataStudioValidationIssue)));
}

function renderIssueList(issues: ReadonlyArray<DataStudioValidationIssue>): JSX.Element | null {
  if (issues.length === 0) {
    return null;
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-preview-ingestion-issues">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Ingestion Issues</strong>
        <div className="ui-row ui-row--wrap">
          {errorCount > 0 ? <span className="ui-badge ui-badge--danger">{errorCount} errors</span> : null}
          {warningCount > 0 ? <span className="ui-badge ui-badge--warning">{warningCount} warnings</span> : null}
        </div>
      </div>
      <ul className="ui-stack ui-stack--2xs">
        {issues.slice(0, 10).map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            <span className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
              [{issue.section}] {issue.message}
            </span>
            {issue.path ? <span className="ui-subtle"> ({issue.path})</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DatasetStudioDraftPreviewPanel({
  draftId,
  draftContent,
}: DatasetStudioDraftPreviewPanelProps): JSX.Element {
  const registry = useMemo(() => getDataStudioAssetRegistry(), []);
  const allIngestionEntries = useMemo(
    () => listIngestionDataAssets({ visibility: IngestionCatalogVisibilityModes.advanced }),
    [registry],
  );
  const defaultIngestionEntries = useMemo(
    () => listIngestionDataAssets({ visibility: IngestionCatalogVisibilityModes.default }),
    [registry],
  );

  const executionFramework = useMemo(() => new DefaultDataAssetExecutionFramework(), []);
  const unifiedIngestionAsset = useMemo(() => new UnifiedIngestionAssetExecutionWrapper(), []);
  const documentIngestor = useMemo(() => new DocumentPdfIngestorAsset(), []);
  const imageIngestor = useMemo(() => new ImageIngestorAsset(), []);
  const batchFramework = useMemo(() => new BatchIngestionFramework(), []);

  const [selectedAssetId, setSelectedAssetId] = useState(
    defaultIngestionEntries.some((entry) => entry.descriptor.assetId === UnifiedIngestionAssetId)
      ? UnifiedIngestionAssetId
      : defaultIngestionEntries[0]?.descriptor.assetId,
  );
  const [showLowLevelIngestors, setShowLowLevelIngestors] = useState(false);
  const visibleEntries = useMemo(
    () => showLowLevelIngestors
      ? allIngestionEntries
      : defaultIngestionEntries,
    [allIngestionEntries, defaultIngestionEntries, showLowLevelIngestors],
  );
  const selectedEntry = useMemo(
    () => allIngestionEntries.find((entry) => entry.descriptor.assetId === selectedAssetId),
    [allIngestionEntries, selectedAssetId],
  );
  const [unifiedMode, setUnifiedMode] = useState<AssetConfigurationMode>("simple");
  const [unifiedPreviewSummary, setUnifiedPreviewSummary] = useState<UnifiedIngestionPreviewSuccess["preview"] | undefined>();
  const [unifiedBatchSummary, setUnifiedBatchSummary] = useState<UnifiedIngestionAssetBatchExecutionResult["result"] | undefined>();

  const supportedSourceModes = useMemo(() => resolveSourceModes(selectedEntry), [selectedEntry]);
  const [sourceMode, setSourceMode] = useState<SourceMode>(supportedSourceModes[0] ?? "in-memory");
  const [sourceReference, setSourceReference] = useState("");
  const [sourcePatterns, setSourcePatterns] = useState("**/*");
  const [sourceExtensions, setSourceExtensions] = useState("");
  const [sourceMaxFiles, setSourceMaxFiles] = useState("");
  const [showAdvancedSourceOptions, setShowAdvancedSourceOptions] = useState(false);
  const [sourcePayload, setSourcePayload] = useState(draftContent ?? "");

  useEffect(() => {
    setSourcePayload(draftContent ?? "");
  }, [draftContent]);

  useEffect(() => {
    setSourceMode((current) => supportedSourceModes.includes(current) ? current : (supportedSourceModes[0] ?? "in-memory"));
  }, [supportedSourceModes]);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }
    if (!showLowLevelIngestors && selectedEntry.descriptor.assetId !== UnifiedIngestionAssetId) {
      setSelectedAssetId(UnifiedIngestionAssetId);
    }
  }, [selectedEntry, showLowLevelIngestors]);

  const schema = selectedEntry?.descriptor.configSchema;
  const [appliedConfig, setAppliedConfig] = useState<Readonly<Record<string, CanonicalRecordValue>>>(() =>
    schema ? resolveDataAssetConfigDefaults(schema, selectedEntry?.baseConfig) : Object.freeze({}),
  );
  const [configValidationIssues, setConfigValidationIssues] = useState<ReadonlyArray<DataStudioValidationIssue>>(Object.freeze([]));

  useEffect(() => {
    if (!schema) {
      setAppliedConfig(Object.freeze({}));
      setConfigValidationIssues(Object.freeze([]));
      return;
    }
    setAppliedConfig(resolveDataAssetConfigDefaults(schema, selectedEntry?.baseConfig));
    setConfigValidationIssues(Object.freeze([]));
  }, [schema, selectedEntry?.baseConfig]);

  const [isLoading, setIsLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<DataAssetExecutionResult | undefined>();
  const [previewModel, setPreviewModel] = useState<DataPreviewModel | undefined>();
  const [previewIssues, setPreviewIssues] = useState<ReadonlyArray<DataStudioValidationIssue>>(Object.freeze([]));

  const panelIssues = useMemo(
    () => Object.freeze([...configValidationIssues, ...previewIssues]),
    [configValidationIssues, previewIssues],
  );

  useEffect(() => {
    if (!selectedAssetId || !selectedEntry) {
      setExecutionResult(undefined);
      setPreviewModel(undefined);
      setUnifiedPreviewSummary(undefined);
      setUnifiedBatchSummary(undefined);
      setPreviewIssues(Object.freeze([]));
      return;
    }

    let disposed = false;
    setIsLoading(true);

    void (async () => {
      try {
        const issues = schema ? validateDataAssetConfigValues(appliedConfig, schema) : Object.freeze([]);
        setConfigValidationIssues(issues);
        if (hasErrorIssues(issues)) {
          setExecutionResult(undefined);
          setPreviewModel(undefined);
          setUnifiedPreviewSummary(undefined);
          setUnifiedBatchSummary(undefined);
          setPreviewIssues(Object.freeze([]));
          return;
        }

        if (selectedAssetId === UnifiedIngestionAssetId) {
          const normalizedReference = sourceReference.trim();
          if ((sourceMode === "local-file" || sourceMode === "local-directory") && !normalizedReference) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setUnifiedPreviewSummary(undefined);
            setUnifiedBatchSummary(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "unified-ingestion-source-path-missing",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "Source mode requires a source path.",
              path: "source.path",
            })]));
            return;
          }

          if (sourceMode === "in-memory" && !String(sourcePayload).trim()) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setUnifiedPreviewSummary(undefined);
            setUnifiedBatchSummary(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "unified-ingestion-source-payload-missing",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "In-memory source mode requires payload content.",
              path: "source.payload",
            })]));
            return;
          }

          const configurationResolution = resolveUnifiedIngestionConfiguration({
            mode: unifiedMode,
            values: appliedConfig,
          });
          if (configurationResolution.issues.some((issue) => issue.severity === "error")) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setUnifiedPreviewSummary(undefined);
            setUnifiedBatchSummary(undefined);
            setPreviewIssues(Object.freeze(configurationResolution.issues.map((issue) => Object.freeze({
              code: issue.code,
              section: DataStudioValidationSections.executionRequest,
              severity: issue.severity,
              message: issue.message,
              path: issue.path,
            }))));
            return;
          }

          if (sourceMode === "local-directory") {
            const supportedExtensions = sourceExtensions
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
              .map((entry) => entry.startsWith(".") ? entry : `.${entry}`);
            const maxFiles = Number(sourceMaxFiles);
            const batchPreview = await unifiedIngestionAsset.previewBatch({
              sourceRequest: {
                input: {
                  kind: SourceInputKinds.localDirectory,
                  path: normalizedReference,
                  patterns: splitPatterns(sourcePatterns),
                },
                config: Object.freeze({
                  ...(supportedExtensions.length > 0 ? { supportedExtensions: Object.freeze(supportedExtensions) } : {}),
                  ...(Number.isFinite(maxFiles) && maxFiles > 0 ? { maxFiles } : {}),
                }),
              },
              configuration: configurationResolution.configuration,
              converterContext: {
                operationId: draftId ? `unified-ingestion-batch-preview-${draftId}` : "unified-ingestion-batch-preview",
                initiatedBy: "dataset-studio-ui",
              },
              options: Object.freeze({
                continueOnError: true,
                maxItems: Number.isFinite(maxFiles) && maxFiles > 0 ? maxFiles : undefined,
                concurrency: 4,
              }),
            });
            if (disposed) {
              return;
            }
            const succeededBatchItems = batchPreview.result.items.filter((item) => item.status === "succeeded");
            setExecutionResult(undefined);
            setUnifiedPreviewSummary(undefined);
            setUnifiedBatchSummary(batchPreview.result);
            setPreviewModel(succeededBatchItems[0]?.preview?.model);
            setPreviewIssues(toUnifiedIngestionIssues([
              ...batchPreview.result.issues,
              ...batchPreview.result.items.flatMap((item) => item.issues),
            ]));
            return;
          }

          const unifiedSource = Object.freeze({
            sourceId: "dataset-preview-source",
            referenceKind: sourceMode === "local-file"
              ? UnifiedIngestionReferenceKinds.localPath
              : UnifiedIngestionReferenceKinds.inMemory,
            reference: sourceMode === "local-file" ? normalizedReference : "in-memory://dataset-preview",
            displayName: sourceMode === "local-file" ? normalizedReference.split(/[\\/]/).at(-1) : undefined,
            extension: sourceMode === "local-file" ? toExtensionFromReference(normalizedReference) : undefined,
          });
          const ingestionExecution = await unifiedIngestionAsset.preview({
            source: unifiedSource,
            payload: sourceMode === "in-memory" ? sourcePayload : undefined,
            configuration: configurationResolution.configuration,
            converterContext: {
              operationId: draftId ? `unified-ingestion-preview-${draftId}` : "unified-ingestion-preview",
              initiatedBy: "dataset-studio-ui",
            },
          });
          const ingestionResult = ingestionExecution.result;

          if (disposed) {
            return;
          }

          if (!ingestionResult.ok) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setUnifiedPreviewSummary(undefined);
            setUnifiedBatchSummary(undefined);
            setPreviewIssues(toUnifiedIngestionIssues(ingestionResult.issues));
            return;
          }

          setExecutionResult(undefined);
          setPreviewModel(ingestionResult.preview.preview);
          setUnifiedPreviewSummary(ingestionResult.preview);
          setUnifiedBatchSummary(undefined);
          setPreviewIssues(toUnifiedIngestionIssues(ingestionResult.preview.issues));
          return;
        }

        setUnifiedPreviewSummary(undefined);
        setUnifiedBatchSummary(undefined);

        if (selectedAssetId === CsvIngestorAsset.assetId || selectedAssetId === JsonIngestorAsset.assetId) {
          if (sourceMode === "local-directory") {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "ingestion-source-mode-invalid",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "This ingestor supports in-memory or local-file source modes.",
              path: "source.mode",
            })]));
            return;
          }

          const runtimeAsset = registry.resolveAsset({
            assetId: selectedAssetId,
            versionId: selectedEntry.descriptor.versionId,
            configOverride: appliedConfig,
          });
          if (!runtimeAsset) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([]));
            return;
          }

          const source = sourceMode === "local-file"
            ? {
              kind: DataSourceReferenceKinds.localFile as const,
              path: sourceReference.trim(),
              formatHint: selectedAssetId === CsvIngestorAsset.assetId ? "csv" as const : "json" as const,
            }
            : {
              kind: DataSourceReferenceKinds.inMemory as const,
              payload: sourcePayload,
              formatHint: selectedAssetId === CsvIngestorAsset.assetId ? "csv" as const : "json" as const,
            };

          if (source.kind === DataSourceReferenceKinds.localFile && !source.path) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "ingestion-source-path-missing",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "Local-file source mode requires a source path.",
              path: "source.path",
            })]));
            return;
          }

          if (source.kind === DataSourceReferenceKinds.inMemory && !String(source.payload).trim()) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "ingestion-source-payload-missing",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "In-memory source mode requires payload content.",
              path: "source.payload",
            })]));
            return;
          }

          const header = toHeader(appliedConfig.header);
          const result = await executionFramework.execute({
            asset: runtimeAsset,
            input: {
              kind: "source-reference",
              source,
              formatHint: selectedAssetId === CsvIngestorAsset.assetId ? "csv" : "json",
              delimiter: toDelimiter(appliedConfig.delimiter),
              header,
              hasHeaderRow: header === "auto" ? undefined : header,
              encoding: typeof appliedConfig.encoding === "string" ? appliedConfig.encoding : "utf-8",
              skipEmptyLines: typeof appliedConfig.skipEmptyLines === "boolean" ? appliedConfig.skipEmptyLines : true,
              normalizeHeadersToLowercase: typeof appliedConfig.normalizeHeadersToLowercase === "boolean"
                ? appliedConfig.normalizeHeadersToLowercase
                : false,
              flatten: typeof appliedConfig.flatten === "boolean" ? appliedConfig.flatten : false,
              maxDepth: typeof appliedConfig.maxDepth === "number" ? appliedConfig.maxDepth : undefined,
            },
            previewOptions: { maxItems: 25, maxColumns: 12, maxTextLength: 320 },
            requestedBy: "dataset-studio-ingestion-preview",
            context: {
              operationId: draftId ? `ingestion-preview-${draftId}` : "ingestion-preview",
              initiatedBy: "dataset-studio-ui",
            },
          });

          if (disposed) {
            return;
          }
          setExecutionResult(result);
          setPreviewModel(undefined);
          setPreviewIssues(Object.freeze([]));
          return;
        }

        if (selectedAssetId === DocumentPdfIngestorAsset.assetId || selectedAssetId === ImageIngestorAsset.assetId) {
          if (sourceMode === "local-directory") {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "ingestion-source-mode-invalid",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "This ingestor supports in-memory or local-file source modes.",
              path: "source.mode",
            })]));
            return;
          }

          const source = sourceMode === "local-file"
            ? {
              kind: DataSourceReferenceKinds.localFile as const,
              path: sourceReference.trim(),
            }
            : {
              kind: DataSourceReferenceKinds.inMemory as const,
              payload: sourcePayload,
              fileName: sourceReference.trim() || undefined,
            };

          if (source.kind === DataSourceReferenceKinds.localFile && !source.path) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "ingestion-source-path-missing",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "Local-file source mode requires a source path.",
              path: "source.path",
            })]));
            return;
          }

          if (source.kind === DataSourceReferenceKinds.inMemory && !String(source.payload).trim()) {
            setExecutionResult(undefined);
            setPreviewModel(undefined);
            setPreviewIssues(Object.freeze([Object.freeze({
              code: "ingestion-source-payload-missing",
              section: DataStudioValidationSections.executionRequest,
              severity: "error",
              message: "In-memory source mode requires payload content.",
              path: "source.payload",
            })]));
            return;
          }

          if (selectedAssetId === DocumentPdfIngestorAsset.assetId) {
            const result = await documentIngestor.resolveAndExecute({
              source,
              config: toDocumentPdfIngestorConfig(appliedConfig),
            });
            if (disposed) {
              return;
            }
            setExecutionResult(undefined);
            if (!result.ok) {
              setPreviewModel(undefined);
              setPreviewIssues(toDataValidationIssues(result.normalized.issues));
              return;
            }
            setPreviewModel(result.preview.normalized.preview);
            setPreviewIssues(toDataValidationIssues(result.preview.normalized.issues));
            return;
          }

          const result = await imageIngestor.resolveAndExecute({
            source,
            config: toImageIngestorConfig(appliedConfig),
          });
          if (disposed) {
            return;
          }
          setExecutionResult(undefined);
          if (!result.ok) {
            setPreviewModel(undefined);
            setPreviewIssues(toDataValidationIssues(result.normalized.issues));
            return;
          }
          setPreviewModel(result.preview.normalized.preview);
          setPreviewIssues(toDataValidationIssues(result.preview.normalized.issues));
          return;
        }

        if (selectedAssetId !== BatchIngestionAssetId) {
          setExecutionResult(undefined);
          setPreviewModel(undefined);
          setPreviewIssues(Object.freeze([]));
          return;
        }

        if (sourceMode === "in-memory") {
          setExecutionResult(undefined);
          setPreviewModel(undefined);
          setPreviewIssues(Object.freeze([Object.freeze({
            code: "batch-source-mode-invalid",
            section: DataStudioValidationSections.executionRequest,
            severity: "error",
            message: "Batch ingestion preview requires local file or local directory source mode.",
            path: "source.mode",
          })]));
          return;
        }

        const pathValue = sourceReference.trim();
        if (!pathValue) {
          setExecutionResult(undefined);
          setPreviewModel(undefined);
          setPreviewIssues(Object.freeze([Object.freeze({
            code: "batch-source-path-missing",
            section: DataStudioValidationSections.executionRequest,
            severity: "error",
            message: "Batch ingestion preview requires a source path.",
            path: "source.path",
          })]));
          return;
        }

        const strategy = typeof appliedConfig.strategy === "string" && appliedConfig.strategy === BatchIngestionStrategyKinds.selected
          ? {
            kind: BatchIngestionStrategyKinds.selected as const,
            ingestor: typeof appliedConfig.selectedIngestor === "string"
              ? appliedConfig.selectedIngestor as typeof BatchIngestorKinds[keyof typeof BatchIngestorKinds]
              : BatchIngestorKinds.csv,
          }
          : { kind: BatchIngestionStrategyKinds.routed as const };

        const supportedExtensions = sourceExtensions
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => entry.startsWith(".") ? entry : `.${entry}`);
        const maxFiles = Number(sourceMaxFiles);
        const sourceRequestConfig = Object.freeze({
          ...(supportedExtensions.length > 0 ? { supportedExtensions: Object.freeze(supportedExtensions) } : {}),
          ...(Number.isFinite(maxFiles) && maxFiles > 0 ? { maxFiles } : {}),
        });

        const result = await batchFramework.previewBatch({
          sourceRequest: {
            input: sourceMode === "local-directory"
              ? {
                kind: SourceInputKinds.localDirectory,
                path: pathValue,
                patterns: splitPatterns(sourcePatterns),
              }
              : {
                kind: SourceInputKinds.localFile,
                path: pathValue,
              },
            config: sourceRequestConfig,
          },
          strategy,
          config: {
            continueOnError: typeof appliedConfig.continueOnError === "boolean" ? appliedConfig.continueOnError : true,
            maxItems: typeof appliedConfig.maxItems === "number" ? appliedConfig.maxItems : undefined,
            previewItemLimit: typeof appliedConfig.previewItemLimit === "number" ? appliedConfig.previewItemLimit : 10,
            concurrency: typeof appliedConfig.concurrency === "number" ? appliedConfig.concurrency : undefined,
          },
        });

        if (disposed) {
          return;
        }
        setExecutionResult(undefined);
        setPreviewModel(result.preview.normalized.preview);
        setPreviewIssues(toDataValidationIssues([
          ...result.preview.normalized.issues,
          ...result.warnings,
        ]));
      } catch (error) {
        if (disposed) {
          return;
        }
        setExecutionResult(undefined);
        setPreviewModel(undefined);
        setPreviewIssues(Object.freeze([Object.freeze({
          code: "ingestion-preview-runtime-failure",
          section: DataStudioValidationSections.executionRequest,
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        })]));
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [
    appliedConfig,
    batchFramework,
    documentIngestor,
    draftId,
    executionFramework,
    imageIngestor,
    registry,
    schema,
    selectedAssetId,
    selectedEntry,
    sourceExtensions,
    sourceMaxFiles,
    sourceMode,
    sourcePatterns,
    sourcePayload,
    sourceReference,
    unifiedIngestionAsset,
    unifiedMode,
  ]);

  const handleApplyConfig = (nextConfig: Readonly<Record<string, CanonicalRecordValue>>) => {
    if (!schema) {
      return;
    }
    const issues = validateDataAssetConfigValues(nextConfig, schema);
    setConfigValidationIssues(issues);
    if (hasErrorIssues(issues)) {
      return;
    }
    setAppliedConfig(nextConfig);
  };

  return (
    <section className="ui-stack ui-stack--sm" data-testid="dataset-studio-draft-preview-panel">
      {visibleEntries.length > 1 ? (
        <label className="ui-field" data-testid="dataset-preview-asset-selector">
          <span className="ui-field__label">Ingestion Asset</span>
          <select
            className="ui-select"
            value={selectedAssetId}
            onChange={(event) => setSelectedAssetId(event.currentTarget.value)}
          >
            {visibleEntries.map((entry) => (
              <option key={`${entry.descriptor.assetId}:${entry.descriptor.versionId ?? "latest"}`} value={entry.descriptor.assetId}>
                {entry.descriptor.display.title ?? entry.descriptor.name}
                {entry.descriptor.versionId ? ` (${entry.descriptor.versionId})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selectedEntry ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-preview-selected-asset-metadata">
          <strong>{selectedEntry.descriptor.display.title ?? selectedEntry.descriptor.name}</strong>
          <span className="ui-subtle">{selectedEntry.descriptor.display.summary ?? "No summary available."}</span>
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <div className="ui-meta-label">Category</div>
              <div className="ui-meta-value">{selectedEntry.descriptor.category}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Output shape</div>
              <div className="ui-meta-value">{selectedEntry.descriptor.outputShapeKind}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Version</div>
              <div className="ui-meta-value">{selectedEntry.descriptor.versionId ?? "latest"}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Source support</div>
              <div className="ui-meta-value">
                {selectedEntry.descriptor.inspectability.supportedSourceKinds.join(", ") || "-"}
              </div>
            </div>
          </div>
          {selectedAssetId === UnifiedIngestionAssetId ? (
            <div className="ui-row ui-row--wrap">
              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={() => setShowLowLevelIngestors((current) => !current)}
                data-testid="dataset-preview-low-level-toggle"
              >
                {showLowLevelIngestors ? "Hide low-level ingestors" : "Inspect low-level ingestors"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-preview-source-input-panel">
        <strong>Source Input</strong>
        <span className="ui-subtle">Select source mode and provide payload/path for ingestion preview.</span>
        <label className="ui-field">
          <span className="ui-field__label">Source mode</span>
          <select
            className="ui-select"
            value={sourceMode}
            onChange={(event) => setSourceMode(event.currentTarget.value as SourceMode)}
          >
            {supportedSourceModes.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </label>

        {sourceMode === "in-memory" ? (
          <label className="ui-field">
            <span className="ui-field__label">In-memory payload</span>
            <textarea
              className="ui-textarea ui-text-mono"
              value={sourcePayload}
              onChange={(event) => setSourcePayload(event.currentTarget.value)}
              placeholder="Paste CSV/JSON/text payload for preview."
            />
          </label>
        ) : (
          <label className="ui-field">
            <span className="ui-field__label">{sourceMode === "local-directory" ? "Directory path" : "File path"}</span>
            <input
              className="ui-input"
              type="text"
              value={sourceReference}
              onChange={(event) => setSourceReference(event.currentTarget.value)}
              placeholder={sourceMode === "local-directory" ? "C:\\data\\ingestion" : "C:\\data\\ingestion\\sample.csv"}
            />
          </label>
        )}

        {sourceMode === "local-directory" ? (
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => setShowAdvancedSourceOptions((current) => !current)}
            data-testid="dataset-preview-source-advanced-toggle"
          >
            {showAdvancedSourceOptions ? "Hide advanced source options" : "Show advanced source options"}
          </button>
        ) : null}

        {sourceMode === "local-directory" && showAdvancedSourceOptions ? (
          <>
            <label className="ui-field">
              <span className="ui-field__label">Directory patterns</span>
              <input
                className="ui-input"
                type="text"
                value={sourcePatterns}
                onChange={(event) => setSourcePatterns(event.currentTarget.value)}
                placeholder="**/*.csv, **/*.json"
              />
              <span className="ui-field__hint">Comma-separated glob patterns.</span>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Extension filter</span>
              <input
                className="ui-input"
                type="text"
                value={sourceExtensions}
                onChange={(event) => setSourceExtensions(event.currentTarget.value)}
                placeholder=".csv, .json, .pdf"
              />
              <span className="ui-field__hint">Optional list of allowed extensions.</span>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Max source files</span>
              <input
                className="ui-input"
                type="number"
                min={1}
                value={sourceMaxFiles}
                onChange={(event) => setSourceMaxFiles(event.currentTarget.value)}
                placeholder="100"
              />
            </label>
          </>
        ) : null}
      </section>

      <AssetConfigurationPanel
        title="Asset Configuration"
        subtitle={selectedAssetId === UnifiedIngestionAssetId
          ? "Simple mode is default. Switch to advanced mode to override detection/routing."
          : "Schema-driven ingestion configuration for the selected asset."}
        schema={schema}
        initialConfig={appliedConfig}
        issues={panelIssues}
        isApplying={isLoading}
        initialMode={selectedAssetId === UnifiedIngestionAssetId ? unifiedMode : "simple"}
        onModeChange={selectedAssetId === UnifiedIngestionAssetId ? setUnifiedMode : undefined}
        onApply={handleApplyConfig}
      />

      {selectedAssetId === UnifiedIngestionAssetId && unifiedPreviewSummary ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-preview-unified-detection-summary">
          <strong>Unified Preview Summary</strong>
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <div className="ui-meta-label">Output kind</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.outputKind}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Rows/items</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.summary.sampleCount} / {unifiedPreviewSummary.summary.totalCount}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Detected kind</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.detectionSummary.detectedKind}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Route handler</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.routeSummary.handlerKind}</div>
            </div>
          </div>
          <div className="ui-row ui-row--wrap">
            <span className="ui-badge ui-badge--neutral">{unifiedPreviewSummary.detectionSummary.confidence} confidence</span>
            <span className="ui-badge ui-badge--neutral">policy: {unifiedPreviewSummary.routeSummary.policy}</span>
            {unifiedPreviewSummary.routeSummary.fallbackUsed ? (
              <span className="ui-badge ui-badge--warning">fallback route</span>
            ) : null}
            {unifiedPreviewSummary.degraded ? (
              <span className="ui-badge ui-badge--warning">degraded preview</span>
            ) : null}
            {unifiedPreviewSummary.summary.truncated ? <span className="ui-badge ui-badge--warning">sampled</span> : null}
          </div>
          <span className="ui-subtle">Route asset: {unifiedPreviewSummary.routeSummary.assetId}</span>
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <div className="ui-meta-label">Output target</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.metadataSummary.outputTarget}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Config mode</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.metadataSummary.configurationMode}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Source asset</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.metadataSummary.sourceAssetId ?? "-"}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Source version</div>
              <div className="ui-meta-value">{unifiedPreviewSummary.metadataSummary.sourceVersionId ?? "-"}</div>
            </div>
          </div>
          <details>
            <summary className="ui-text-small">Diagnostics and Samples</summary>
            <div className="ui-stack ui-stack--xs">
              {unifiedPreviewSummary.samples.length > 0 ? (
                <pre className="ui-text-mono">{JSON.stringify(unifiedPreviewSummary.samples, null, 2)}</pre>
              ) : (
                <span className="ui-subtle">No preview samples available.</span>
              )}
              {unifiedPreviewSummary.issues.length > 0 ? (
                <pre className="ui-text-mono">{JSON.stringify(unifiedPreviewSummary.issues, null, 2)}</pre>
              ) : (
                <span className="ui-subtle">No preview issues.</span>
              )}
            </div>
          </details>
        </section>
      ) : null}

      {selectedAssetId === UnifiedIngestionAssetId && unifiedBatchSummary ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-preview-unified-batch-summary">
          <strong>Unified Batch Summary</strong>
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <div className="ui-meta-label">Items</div>
              <div className="ui-meta-value">{unifiedBatchSummary.summary.totalItems}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Succeeded</div>
              <div className="ui-meta-value">{unifiedBatchSummary.summary.succeeded}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Failed</div>
              <div className="ui-meta-value">{unifiedBatchSummary.summary.failed}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Skipped</div>
              <div className="ui-meta-value">{unifiedBatchSummary.summary.skipped}</div>
            </div>
          </div>
          <div className="ui-row ui-row--wrap">
            {unifiedBatchSummary.summary.partialSuccess ? <span className="ui-badge ui-badge--warning">partial success</span> : null}
            {Object.entries(unifiedBatchSummary.summary.sourceKindDistribution).map(([kind, count]) => (
              <span key={kind} className="ui-badge ui-badge--neutral">{kind}: {count}</span>
            ))}
          </div>
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <div className="ui-meta-label">Output target</div>
              <div className="ui-meta-value">{unifiedBatchSummary.metadata.processing.outputTarget}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Config mode</div>
              <div className="ui-meta-value">{unifiedBatchSummary.metadata.processing.configurationMode}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Records</div>
              <div className="ui-meta-value">{unifiedBatchSummary.metadata.outputs.totalRecordCount}</div>
            </div>
            <div className="ui-meta-item">
              <div className="ui-meta-label">Text items</div>
              <div className="ui-meta-value">{unifiedBatchSummary.metadata.outputs.totalTextItemCount}</div>
            </div>
          </div>
          <details>
            <summary className="ui-text-small">Per-item Status</summary>
            <ul className="ui-stack ui-stack--2xs">
              {unifiedBatchSummary.items.slice(0, 20).map((item, index) => (
                <li key={`${item.source.sourceId}-${index}`} className="ui-row ui-row--between ui-row--wrap">
                  <span>{item.source.displayName ?? item.source.reference}</span>
                  <span className="ui-subtle">{item.status}{item.routeHandler ? ` • ${item.routeHandler}` : ""}</span>
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary className="ui-text-small">Lineage Details</summary>
            <div className="ui-stack ui-stack--xs">
              <span className="ui-subtle">Batch lineage: {unifiedBatchSummary.lineage.lineageId}</span>
              <pre className="ui-text-mono">{JSON.stringify(unifiedBatchSummary.lineage.summary, null, 2)}</pre>
            </div>
          </details>
        </section>
      ) : null}

      {executionResult ? (
        <DataPreviewPanel
          title="Ingestion Preview"
          isLoading={isLoading}
          executionResult={executionResult}
          emptyMessage="Provide source input to preview ingestion output."
        />
      ) : null}

      {!executionResult && previewModel ? (
        <DataPreviewSurface preview={previewModel} title="Ingestion Preview" />
      ) : null}

      {!executionResult && !previewModel && !isLoading ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--xs">
          <strong>Ingestion Preview</strong>
          <span className="ui-text-muted">Provide source input to preview ingestion output.</span>
        </section>
      ) : null}

      {renderIssueList(previewIssues)}
    </section>
  );
}
