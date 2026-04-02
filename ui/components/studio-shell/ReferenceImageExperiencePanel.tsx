import { useMemo, useState } from "react";
import { ReferenceImageSystemTemplate } from "../../../application/system-studio/ReferenceImageSystemTemplate";
import { createDefaultUiTriggerSystemContextMapper } from "../../../application/workflow-studio/UiTriggerSystemContextMapper";
import { createDefaultWorkflowSystemContextBindingAdapter } from "../../../application/workflow-studio/SystemContextWorkflowInputMapper";
import { createUiTriggerEvent } from "../../../application/workflow-studio/UiTriggerEventContract";
import type { FileIngestionPolicy } from "../../../domain/ingestion/interfaces/IFileIngestion";
import { createBrowserImageUploadIngestionAdapter } from "../assets/image-system/BrowserImageUploadIngestionAdapter";
import { ImageUploadPanel } from "../assets/image-system/ImageUploadPanel";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";

const uploadPolicy: FileIngestionPolicy = Object.freeze({
  acceptedExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
  acceptedMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  maxFileSizeBytes: 15 * 1024 * 1024,
  conversion: {
    mode: "forbidden",
    allowedOutputFormats: Object.freeze([]),
    passThroughExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
    passThroughMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  },
});

async function encodeFileBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

interface ReferenceImageExperiencePanelProps {
  readonly context: StudioShellExtensionContext;
}

export function buildReferenceImageStartRequest(input: {
  readonly studioId: string;
  readonly draftId: string;
  readonly systemAssetId: string;
  readonly datasetInstanceId: string;
  readonly selectedRecordId: string;
  readonly selectedAssetId: string;
  readonly editInstruction: string;
  readonly variationStrength: number;
  readonly resultCount: number;
}) {
  const mapper = createDefaultUiTriggerSystemContextMapper();
  const bindingAdapter = createDefaultWorkflowSystemContextBindingAdapter({
    mappingConfiguration: ReferenceImageSystemTemplate.primaryWorkflowAsset.contextMapping,
  });
  const event = createUiTriggerEvent({
    kind: "submit",
    name: "ui.reference-image.start",
    source: {
      studio: "system-studio",
      componentId: "reference-image-experience",
      actionId: "start",
    },
    payload: {
      imageId: input.selectedAssetId,
      selectedImage: {
        imageId: input.selectedRecordId,
        assetRef: {
          assetId: input.selectedAssetId,
          recordId: input.selectedRecordId,
        },
      },
      parameters: {
        editInstruction: input.editInstruction,
        variationStrength: input.variationStrength,
        resultCount: input.resultCount,
      },
    },
    context: {
      systemAssetId: input.systemAssetId,
      references: {
        systemDatasetInstanceId: input.datasetInstanceId,
        datasetInstanceId: input.datasetInstanceId,
        systemDatasetRole: "input-store",
      },
    },
  });
  const systemContext = mapper.map(event);
  const mapped = bindingAdapter.map(systemContext);
  return Object.freeze({
    studioId: input.studioId,
    draftId: input.draftId,
    context: Object.freeze({
      trigger: "manual" as const,
      actorId: "reference-image-ui",
      inputValues: mapped.inputValues,
      metadata: mapped.metadata,
    }),
  });
}

export function ReferenceImageExperiencePanel({ context }: ReferenceImageExperiencePanelProps): JSX.Element {
  const snapshot = context.snapshot;
  const draft = snapshot?.draft;
  const isReferenceImageDraft = draft?.assetId === ReferenceImageSystemTemplate.systemAsset.assetId;
  const studioShell = useMemo(() => new StudioShellService(), []);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [datasetInstanceId, setDatasetInstanceId] = useState<string | undefined>();
  const [editInstruction, setEditInstruction] = useState("");
  const [variationStrength, setVariationStrength] = useState(0.5);
  const [resultCount, setResultCount] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const uploadAdapter = useMemo(() => createBrowserImageUploadIngestionAdapter({ policy: uploadPolicy }), []);

  if (!isReferenceImageDraft || !draft) {
    return (
      <section className="ui-image-surface ui-image-surface--status">
        This template panel appears when the reference image system is open.
      </section>
    );
  }

  return (
    <section className="ui-stack ui-stack--sm">
      <ImageUploadPanel
        title="Upload image"
        acceptedMimeTypes={["image/png", "image/jpeg", "image/webp"]}
        maxUploadCount={1}
        ingestionAdapter={uploadAdapter}
        targetContext={{
          system: {
            systemAssetId: draft.assetId,
          },
          dataset: datasetInstanceId
            ? {
              datasetAssetId: "asset:dataset:image-reference-input",
              datasetVersionId: "v1",
              systemDatasetInstanceId: datasetInstanceId,
            }
            : undefined,
        }}
        disabled={context.isBusy || isUploading}
        onUploadRequested={(event) => {
          const file = event.files[0];
          if (!file) {
            return;
          }
          setIsUploading(true);
          setStatus(undefined);
          void encodeFileBase64(file)
            .then((payloadBase64) => studioShell.ingestReferenceImageUpload({
              studioId: context.studioId,
              draftId: draft.draftId,
              fileName: file.name,
              mimeType: file.type,
              payloadBase64,
            }))
            .then((response) => {
              if (!response.ok || !response.data) {
                setStatus(response.error?.message ?? "Upload failed.");
                return;
              }
              setSelectedRecordId(response.data.recordId);
              setSelectedAssetId(response.data.image.assetId);
              setDatasetInstanceId(response.data.datasetInstanceId);
              setStatus("Image uploaded and ready.");
            })
            .finally(() => {
              setIsUploading(false);
            });
        }}
      />
      <section className="ui-image-surface">
        <header className="ui-image-surface__header">
          <h3 className="ui-image-surface__title">Processing settings</h3>
        </header>
        <label className="ui-form-field">
          <span className="ui-form-field__label">Edit instructions</span>
          <textarea className="ui-input" value={editInstruction} onChange={(event) => setEditInstruction(event.currentTarget.value)} rows={3} />
        </label>
        <details>
          <summary className="ui-text-small ui-text-secondary">Advanced</summary>
          <div className="ui-grid ui-grid--2" style={{ marginTop: "0.5rem" }}>
            <label className="ui-form-field">
              <span className="ui-form-field__label">Variation strength</span>
              <input className="ui-input" type="number" min={0} max={1} step={0.05} value={variationStrength} onChange={(event) => setVariationStrength(Number(event.currentTarget.value) || 0)} />
            </label>
            <label className="ui-form-field">
              <span className="ui-form-field__label">Result count</span>
              <input className="ui-input" type="number" min={1} max={4} step={1} value={resultCount} onChange={(event) => setResultCount(Math.max(1, Number(event.currentTarget.value) || 1))} />
            </label>
          </div>
        </details>
      </section>
      <section className="ui-image-surface">
        <header className="ui-image-surface__header">
          <h3 className="ui-image-surface__title">Results</h3>
        </header>
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={!selectedRecordId || !selectedAssetId || !datasetInstanceId || isStarting || !context.operations.startSystemExecution}
          onClick={() => {
            if (!selectedRecordId || !selectedAssetId || !datasetInstanceId || !context.operations.startSystemExecution) {
              return;
            }
            setIsStarting(true);
            const request = buildReferenceImageStartRequest({
              studioId: context.studioId,
              draftId: draft.draftId,
              systemAssetId: draft.assetId,
              datasetInstanceId,
              selectedRecordId,
              selectedAssetId,
              editInstruction,
              variationStrength,
              resultCount,
            });
            void context.operations.startSystemExecution(request).then((response) => {
              setStatus(response.ok && response.data
                ? `Started processing (${response.data.executionId}).`
                : (response.error?.message ?? "Could not start processing."));
            }).finally(() => setIsStarting(false));
          }}
        >
          {isStarting ? "Starting..." : "Start"}
        </button>
        {status ? <p className="ui-text-small ui-text-secondary">{status}</p> : null}
      </section>
    </section>
  );
}
