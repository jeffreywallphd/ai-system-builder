import { useEffect, useMemo, useState } from "react";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetRegistry,
  DataAssetRegistrySpecializations,
  type DataAssetRegistryEntry,
} from "../../../application/dataset-studio/DataAssetRegistry";
import {
  resolveDataAssetConfigDefaults,
} from "../../../application/dataset-studio/DataAssetConfiguration";
import {
  DefaultDataAssetExecutionFramework,
  type DataAssetExecutionResult,
} from "../../../application/dataset-studio/DataAssetExecutionFramework";
import {
  DataSourceReferenceKinds,
} from "../../../application/dataset-studio/DataConverterContracts";
import {
  DataStudioValidationSections,
  hasErrorIssues,
  validateDataAssetConfigValues,
  type DataStudioValidationIssue,
} from "../../../application/dataset-studio/DataStudioValidation";
import {
  CsvIngestorAsset,
  createCsvIngestorConfigSchema,
} from "../../../application/dataset-studio/CsvIngestorAsset";
import {
  JsonIngestorAsset,
  createJsonIngestorConfigSchema,
} from "../../../application/dataset-studio/JsonIngestorAsset";
import AssetConfigurationPanel from "./AssetConfigurationPanel";
import DataPreviewPanel from "./DataPreviewPanel";

export interface DatasetStudioDraftPreviewPanelProps {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
  readonly draftContent?: string;
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

function createPreviewAsset(input: {
  readonly assetId: string;
  readonly title: string;
  readonly config: Readonly<Record<string, CanonicalRecordValue>>;
}): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: input.assetId,
    name: input.title,
    source: { type: "generated", workflowId: "dataset-studio-preview" },
    location: { accessMethod: "virtual", location: `dataset://${input.assetId}` },
    outputShape: createCanonicalRecordsShape({ records: [] }),
    config: input.config,
    semanticMetadata: {
      description: "Dataset Studio preview source-to-records data asset.",
      tags: ["dataset", "data-studio", "preview"],
    },
  });
}

function createRegistry(input: {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
}): DataAssetRegistry {
  const registry = new DataAssetRegistry();
  const suffix = input.draftAssetId ?? `dataset-preview-${input.draftId ?? "draft"}`;
  registry.register({
    asset: createPreviewAsset({
      assetId: CsvIngestorAsset.assetId,
      title: "CSV Ingestor",
      config: resolveDataAssetConfigDefaults(createCsvIngestorConfigSchema(`${suffix}-csv`)),
    }),
    specialization: DataAssetRegistrySpecializations.ingestion,
    display: {
      title: "CSV Ingestor",
      summary: "Schema-driven CSV ingestion and canonical records preview.",
      tags: ["dataset", "preview", "csv", "ingestion"],
    },
    configSchema: createCsvIngestorConfigSchema(`${suffix}-csv`),
    assetFactory: (config) => createPreviewAsset({
      assetId: CsvIngestorAsset.assetId,
      title: "CSV Ingestor",
      config,
    }),
  });

  registry.register({
    asset: createPreviewAsset({
      assetId: JsonIngestorAsset.assetId,
      title: "JSON Ingestor",
      config: resolveDataAssetConfigDefaults(createJsonIngestorConfigSchema(`${suffix}-json`)),
    }),
    specialization: DataAssetRegistrySpecializations.ingestion,
    display: {
      title: "JSON Ingestor",
      summary: "Schema-driven JSON ingestion and canonical records preview.",
      tags: ["dataset", "preview", "json", "ingestion"],
    },
    configSchema: createJsonIngestorConfigSchema(`${suffix}-json`),
    assetFactory: (config) => createPreviewAsset({
      assetId: JsonIngestorAsset.assetId,
      title: "JSON Ingestor",
      config,
    }),
  });

  return registry;
}

function mergePanelIssues(
  configIssues: ReadonlyArray<DataStudioValidationIssue>,
  execution?: DataAssetExecutionResult,
): ReadonlyArray<DataStudioValidationIssue> {
  const executionConfigIssues = execution?.validationIssues.filter((issue) => issue.section === DataStudioValidationSections.dataAssetConfig) ?? [];
  return Object.freeze([...configIssues, ...executionConfigIssues]);
}

export default function DatasetStudioDraftPreviewPanel({
  draftId,
  draftAssetId,
  draftTitle,
  draftContent,
}: DatasetStudioDraftPreviewPanelProps): JSX.Element {
  const registry = useMemo(() => createRegistry({ draftId, draftAssetId, draftTitle }), [draftAssetId, draftId, draftTitle]);
  const executionFramework = useMemo(() => new DefaultDataAssetExecutionFramework(), []);

  const entries = useMemo(() => registry.list({ executable: true }), [registry]);
  const [selectedAssetId, setSelectedAssetId] = useState(entries[0]?.descriptor.assetId);

  useEffect(() => {
    setSelectedAssetId((current) => {
      if (current && entries.some((entry) => entry.descriptor.assetId === current)) {
        return current;
      }
      return entries[0]?.descriptor.assetId;
    });
  }, [entries]);

  const selectedEntry = useMemo(() => {
    if (!selectedAssetId) {
      return undefined;
    }

    return registry.get({ assetId: selectedAssetId });
  }, [registry, selectedAssetId]);

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
  const panelIssues = useMemo(
    () => mergePanelIssues(configValidationIssues, executionResult),
    [configValidationIssues, executionResult],
  );

  useEffect(() => {
    const content = draftContent?.trim();
    if (!content || !selectedAssetId) {
      setExecutionResult(undefined);
      setIsLoading(false);
      return;
    }

    let disposed = false;
    setIsLoading(true);

    void (async () => {
      try {
        const resolvedAsset = registry.resolveAsset({
          assetId: selectedAssetId,
          configOverride: appliedConfig,
        });

        if (!resolvedAsset) {
          setExecutionResult(undefined);
          setIsLoading(false);
          return;
        }

        const header = toHeader(appliedConfig.header);

        const result = await executionFramework.execute({
          asset: resolvedAsset,
          input: {
            kind: "source-reference",
            source: {
              kind: DataSourceReferenceKinds.inMemory,
              payload: content,
              formatHint: selectedAssetId === CsvIngestorAsset.assetId ? "csv" : "json",
            },
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
          requestedBy: "dataset-studio-preview-panel",
          context: {
            operationId: draftId ? `preview-${draftId}` : "preview-draft",
            initiatedBy: "dataset-studio-ui",
          },
        });

        if (disposed) {
          return;
        }

        setExecutionResult(result);
      } catch {
        if (disposed) {
          return;
        }
        setExecutionResult(undefined);
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [appliedConfig, draftContent, draftId, executionFramework, registry, selectedAssetId]);

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
      {entries.length > 1 ? (
        <label className="ui-field" data-testid="dataset-preview-asset-selector">
          <span className="ui-field__label">Data Asset</span>
          <select
            className="ui-select"
            value={selectedAssetId}
            onChange={(event) => setSelectedAssetId(event.currentTarget.value)}
          >
            {entries.map((entry: DataAssetRegistryEntry) => (
              <option key={`${entry.descriptor.assetId}:${entry.descriptor.versionId ?? "latest"}`} value={entry.descriptor.assetId}>
                {entry.descriptor.display.title ?? entry.descriptor.name}
                {entry.descriptor.versionId ? ` (${entry.descriptor.versionId})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <AssetConfigurationPanel
        title="Asset Configuration"
        subtitle="Apply schema-driven parsing and preview options for this data asset."
        schema={schema}
        initialConfig={appliedConfig}
        issues={panelIssues}
        isApplying={isLoading}
        onApply={handleApplyConfig}
      />

      <DataPreviewPanel
        title="Data Preview Panel"
        isLoading={isLoading}
        executionResult={executionResult}
        emptyMessage="Draft content is empty. Add records to preview canonical output."
      />
    </section>
  );
}
