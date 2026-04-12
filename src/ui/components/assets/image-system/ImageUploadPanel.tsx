import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type JSX } from "react";
import type {
  ImageUploadPanelEventContract,
  ImageUploadPanelPropsContract,
  ImageUploadValidationResult,
  ImageUploadValidationIssue,
} from "./ImageUiContracts";
import { emitImageUiEvent } from "./ImageUiEventAdapters";

export interface ImageUploadPanelProps extends ImageUploadPanelPropsContract, ImageUploadPanelEventContract {
  readonly title?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly resolvedPreviewPathsByFileName?: Readonly<Record<string, string>>;
  readonly configuredSavePath?: string;
}

function buildSelectionSummary(issues: ReadonlyArray<ImageUploadValidationIssue>): string {
  if (issues.length === 0) {
    return "Ready to ingest selected files.";
  }
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return `${errorCount} errors, ${warningCount} warnings.`;
}

export function ImageUploadPanel({
  acceptedMimeTypes,
  maxUploadCount,
  targetContext,
  ingestionAdapter,
  onUploadRequested,
  onValidationChanged,
  onEvent,
  title = "Upload images",
  className,
  disabled = false,
  resolvedPreviewPathsByFileName,
  configuredSavePath,
}: ImageUploadPanelProps): JSX.Element {
  const [isDragActive, setIsDragActive] = useState(false);
  const [validation, setValidation] = useState<ImageUploadValidationResult>({
    acceptedFiles: Object.freeze([]),
    rejectedFiles: Object.freeze([]),
    issues: Object.freeze([]),
  });
  const [previewUrls, setPreviewUrls] = useState<ReadonlyArray<{
    readonly fileName: string;
    readonly filePath?: string;
    readonly url: string;
  }>>(Object.freeze([]));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptAttribute = acceptedMimeTypes.join(",");
  const summary = useMemo(() => buildSelectionSummary(validation.issues), [validation.issues]);

  useEffect(() => {
    onValidationChanged?.({
      sourceComponent: "upload-panel",
      validation,
      context: targetContext,
    });
  }, [onValidationChanged, targetContext, validation]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, [previewUrls]);

  const applyValidation = (result: ImageUploadValidationResult) => {
    setValidation(result);
    setPreviewUrls((current) => {
      current.forEach((entry) => URL.revokeObjectURL(entry.url));
      return Object.freeze(result.acceptedFiles.map((file) => {
        const maybePath = (file as File & { readonly path?: string }).path;
        const filePath = typeof maybePath === "string" && maybePath.trim().length > 0
          ? maybePath.trim()
          : undefined;
        return {
          fileName: file.name,
          filePath,
          url: URL.createObjectURL(file),
        };
      }));
    });
  };

  const evaluateFiles = (files: ReadonlyArray<File>) => {
    if (disabled) {
      return;
    }
    emitImageUiEvent(onEvent, {
      type: "upload-initiated",
      sourceComponent: "upload-panel",
      context: targetContext,
      payload: {
        fileCount: files.length,
        fileNames: Object.freeze(files.map((file) => file.name)),
      },
    });

    const defaultResult: ImageUploadValidationResult = {
      acceptedFiles: Object.freeze(files),
      rejectedFiles: Object.freeze([]),
      issues: Object.freeze([]),
    };

    const result = ingestionAdapter
      ? ingestionAdapter.evaluate({ files, acceptedMimeTypes, maxUploadCount, context: targetContext })
      : defaultResult;

    applyValidation(result);
    if (result.acceptedFiles.length > 0) {
      emitImageUiEvent(onEvent, {
        type: "upload-completed",
        sourceComponent: "upload-panel",
        context: targetContext,
        payload: {
          acceptedCount: result.acceptedFiles.length,
          rejectedCount: result.rejectedFiles.length,
          issueCount: result.issues.length,
          issueCodes: Object.freeze(result.issues.map((issue) => issue.code)),
        },
      });
    } else {
      emitImageUiEvent(onEvent, {
        type: "upload-failed",
        sourceComponent: "upload-panel",
        context: targetContext,
        payload: {
          rejectedCount: result.rejectedFiles.length,
          issueCount: result.issues.length,
          issueCodes: Object.freeze(result.issues.map((issue) => issue.code)),
        },
      });
    }
    if (result.acceptedFiles.length > 0) {
      onUploadRequested?.({ files: result.acceptedFiles, context: targetContext });
    }
  };

  const onInputChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    evaluateFiles(files);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    evaluateFiles(files);
  };

  return (
    <section className={["ui-image-upload-panel", "ui-image-surface", className ?? ""].filter(Boolean).join(" ")} aria-label={title}>
      <header className="ui-image-upload-panel__header ui-image-surface__header">
        <h3 className="ui-image-upload-panel__title ui-image-surface__title">{title}</h3>
        <span className="ui-text-small ui-text-secondary">{summary}</span>
      </header>
      {configuredSavePath ? (
        <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
          Upload save path: <code>{configuredSavePath}</code>
        </p>
      ) : null}
      <div
        className={[
          "ui-image-upload-panel__dropzone",
          isDragActive ? "ui-image-upload-panel__dropzone--active" : "",
          disabled ? "ui-image-upload-panel__dropzone--disabled" : "",
        ].filter(Boolean).join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragActive(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={onDrop}
      >
        <p className="ui-text-small ui-text-secondary">Drag and drop image files, or choose from your device.</p>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttribute}
          multiple={maxUploadCount === undefined || maxUploadCount > 1}
          hidden
          onChange={onInputChanged}
          disabled={disabled}
        />
      </div>

      {previewUrls.length > 0 ? (
        <div className="ui-image-upload-panel__preview-grid">
          {previewUrls.map((entry) => (
            <article key={entry.fileName} className="ui-image-upload-panel__preview-item">
              <img src={entry.url} alt={entry.fileName} className="ui-image-upload-panel__preview-image" loading="lazy" decoding="async" />
              <span className="ui-text-small ui-text-secondary">{entry.fileName}</span>
              <span className="ui-text-small ui-text-secondary">
                {resolvedPreviewPathsByFileName?.[entry.fileName] ?? entry.filePath ?? entry.fileName}
              </span>
            </article>
          ))}
        </div>
      ) : null}

      {validation.issues.length > 0 ? (
        <ul className="ui-image-upload-panel__issues" aria-live="polite">
          {validation.issues.map((issue) => (
            <li key={`${issue.code}:${issue.fileName ?? issue.message}`} className={issue.severity === "error" ? "ui-text-danger" : "ui-text-small ui-text-secondary"}>
              {issue.fileName ? `${issue.fileName}: ` : ""}{issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
