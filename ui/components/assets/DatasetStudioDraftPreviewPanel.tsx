import { useEffect, useMemo, useState } from "react";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetRegistry,
  DataAssetRegistrySpecializations,
  type DataAssetRegistryEntry,
} from "../../../application/dataset-studio/DataAssetRegistry";
import {
  DataAssetConfigFieldKinds,
  createDataAssetConfigSchema,
  resolveDataAssetConfigDefaults,
  type DataAssetConfigSchema,
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
import AssetConfigurationPanel from "./AssetConfigurationPanel";
import DataPreviewPanel from "./DataPreviewPanel";

export interface DatasetStudioDraftPreviewPanelProps {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
  readonly draftContent?: string;
}

function toNumberOr(input: CanonicalRecordValue | undefined, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input)
    ? input
    : fallback;
}

function toBooleanOr(input: CanonicalRecordValue | undefined, fallback: boolean): boolean {
  return typeof input === "boolean" ? input : fallback;
}

function toFormatHint(input: CanonicalRecordValue | undefined): "json" | "csv" | "tsv" | "text" {
  if (input === "csv" || input === "tsv" || input === "text") {
    return input;
  }

  return "json";
}

function toDelimiter(input: CanonicalRecordValue | undefined): "," | "\t" | ";" | "|" {
  if (input === "\t" || input === ";" || input === "|") {
    return input;
  }

  return ",";
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

function buildPreviewAssetSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.preview-config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "formatHint",
        label: "Input format",
        kind: DataAssetConfigFieldKinds.select,
        description: "How draft content should be parsed before canonical conversion.",
        required: true,
        defaultValue: "json",
        options: Object.freeze([
          { value: "json", label: "JSON" },
          { value: "csv", label: "CSV" },
          { value: "tsv", label: "TSV" },
          { value: "text", label: "Text" },
        ]),
      },
      {
        key: "delimiter",
        label: "Delimiter",
        kind: DataAssetConfigFieldKinds.select,
        required: true,
        defaultValue: ",",
        options: Object.freeze([
          { value: ",", label: "Comma" },
          { value: "\t", label: "Tab" },
          { value: ";", label: "Semicolon" },
          { value: "|", label: "Pipe" },
        ]),
      },
      {
        key: "hasHeaderRow",
        label: "Header row",
        kind: DataAssetConfigFieldKinds.boolean,
        description: "Treat the first row as column headers for delimited sources.",
        defaultValue: true,
      },
      {
        key: "previewMaxItems",
        label: "Preview max items",
        kind: DataAssetConfigFieldKinds.number,
        min: 1,
        max: 200,
        required: true,
        defaultValue: 12,
      },
      {
        key: "previewMaxColumns",
        label: "Preview max columns",
        kind: DataAssetConfigFieldKinds.number,
        min: 1,
        max: 80,
        required: true,
        defaultValue: 10,
      },
      {
        key: "previewMaxTextLength",
        label: "Preview max text length",
        kind: DataAssetConfigFieldKinds.number,
        min: 32,
        max: 4000,
        required: true,
        defaultValue: 320,
      },
    ]),
  });
}

function createRegistry(input: {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
}): DataAssetRegistry {
  const registry = new DataAssetRegistry();
  const assetId = input.draftAssetId ?? `dataset-preview-${input.draftId ?? "draft"}`;
  const title = input.draftTitle ?? "Dataset Draft Preview";
  const configSchema = buildPreviewAssetSchema(assetId);
  const baseConfig = resolveDataAssetConfigDefaults(configSchema);

  registry.register({
    asset: createPreviewAsset({
      assetId,
      title,
      config: baseConfig,
    }),
    specialization: DataAssetRegistrySpecializations.converter,
    display: {
      title,
      summary: "Schema-driven converter execution for draft preview.",
      tags: ["dataset", "preview", "converter"],
    },
    configSchema,
    assetFactory: (config) => createPreviewAsset({
      assetId,
      title,
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
  const [appliedConfig, setAppliedConfig] = useState<Readonly<Record<string, CanonicalRecordValue>>(() =>
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

        const result = await executionFramework.execute({
          asset: resolvedAsset,
          input: {
            kind: "source-reference",
            source: {
              kind: DataSourceReferenceKinds.inMemory,
              payload: content,
              formatHint: toFormatHint(appliedConfig.formatHint),
            },
            formatHint: toFormatHint(appliedConfig.formatHint),
            delimiter: toDelimiter(appliedConfig.delimiter),
            hasHeaderRow: toBooleanOr(appliedConfig.hasHeaderRow, true),
          },
          previewOptions: {
            maxItems: toNumberOr(appliedConfig.previewMaxItems, 12),
            maxColumns: toNumberOr(appliedConfig.previewMaxColumns, 10),
            maxTextLength: toNumberOr(appliedConfig.previewMaxTextLength, 320),
          },
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
