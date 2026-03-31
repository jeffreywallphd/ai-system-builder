import { useEffect, useMemo, useState } from "react";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { DataAssetFactory } from "../../../application/dataset-studio/DataAssetFactory";
import {
  DefaultDataAssetExecutionFramework,
  type DataAssetExecutionResult,
} from "../../../application/dataset-studio/DataAssetExecutionFramework";
import {
  DataConverterOperationKinds,
  DataSourceReferenceKinds,
  type DataConverterResult,
} from "../../../application/dataset-studio/DataConverterContracts";
import { DataConverterCore } from "../../../application/dataset-studio/DataConverterCore";
import DataPreviewPanel from "./DataPreviewPanel";

export interface DatasetStudioDraftPreviewPanelProps {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
  readonly draftContent?: string;
}

function createFallbackAsset(input: {
  readonly assetId?: string;
  readonly name?: string;
}): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: input.assetId ?? "dataset-preview-draft",
    name: input.name ?? "Dataset Draft",
    source: { type: "generated", workflowId: "dataset-studio-preview" },
    location: { accessMethod: "virtual", location: "dataset://preview" },
    outputShape: createCanonicalRecordsShape({ records: [] }),
  });
}

function createExecutionFromConverterResult(input: {
  readonly draftId?: string;
  readonly draftAssetId?: string;
  readonly draftTitle?: string;
  readonly converterResult: DataConverterResult;
}): Promise<DataAssetExecutionResult> {
  const execution = new DefaultDataAssetExecutionFramework();
  const factory = new DataAssetFactory();
  const asset = input.converterResult.ok
    ? factory.createFromConverterResult({
      assetId: input.draftAssetId ?? `dataset-preview-${input.draftId ?? "draft"}`,
      name: input.draftTitle ?? "Dataset Draft",
    }, input.converterResult)
    : createFallbackAsset({
      assetId: input.draftAssetId,
      name: input.draftTitle,
    });

  return execution.execute({
    asset,
    input: {
      kind: "converter-result",
      result: input.converterResult,
    },
    requestedBy: "dataset-studio-preview-panel",
    context: {
      operationId: input.draftId ? `preview-${input.draftId}` : "preview-draft",
      initiatedBy: "dataset-studio-ui",
    },
  });
}

export default function DatasetStudioDraftPreviewPanel({
  draftId,
  draftAssetId,
  draftTitle,
  draftContent,
}: DatasetStudioDraftPreviewPanelProps): JSX.Element {
  const converter = useMemo(() => new DataConverterCore(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<DataAssetExecutionResult | undefined>();

  useEffect(() => {
    const content = draftContent?.trim();
    if (!content) {
      setExecutionResult(undefined);
      setIsLoading(false);
      return;
    }

    let disposed = false;
    setIsLoading(true);
    const converterResult = converter.convert({
      operation: DataConverterOperationKinds.sourceToRecords,
      source: {
        kind: DataSourceReferenceKinds.inMemory,
        reference: "dataset-studio-draft",
        payload: content,
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
    });

    void createExecutionFromConverterResult({
      draftId,
      draftAssetId,
      draftTitle,
      converterResult,
    }).then((result) => {
      if (disposed) {
        return;
      }
      setExecutionResult(result);
      setIsLoading(false);
    }).catch(() => {
      if (disposed) {
        return;
      }
      setExecutionResult(undefined);
      setIsLoading(false);
    });

    return () => {
      disposed = true;
    };
  }, [converter, draftAssetId, draftContent, draftId, draftTitle]);

  return (
    <DataPreviewPanel
      title="Data Preview Panel"
      isLoading={isLoading}
      executionResult={executionResult}
      emptyMessage="Draft content is empty. Add JSON records to preview sample output."
    />
  );
}
