import { useMemo, useState } from "react";
import type { IModelInstallProgress } from "@application/ports/interfaces/IModelInstaller";
import { formatBytes } from "../../presenters/PresenterFormatting";
import type {
  ModelDownloadFileViewModel,
  ModelListItemViewModel,
  RemoteModelListItemViewModel,
} from "../../presenters/ModelPresenter";

export interface ModelCardProps {
  readonly model: ModelListItemViewModel | RemoteModelListItemViewModel;
  readonly mode?: "installed" | "remote";
  readonly installProgress?: IModelInstallProgress;
  readonly isDetailsExpanded?: boolean;
  readonly selectedFileIds?: ReadonlyArray<string>;
  readonly onToggleDetails?: (modelId: string) => void;
  readonly onToggleFileSelection?: (modelId: string, fileId: string) => void;
  readonly onDownloadFile?: (modelId: string, file: ModelDownloadFileViewModel) => void;
  readonly onDownloadFiles?: (
    modelId: string,
    files: ReadonlyArray<ModelDownloadFileViewModel>
  ) => void;
  readonly onRemove?: (modelId: string) => void;
}

function isRemoteModel(
  model: ModelListItemViewModel | RemoteModelListItemViewModel
): model is RemoteModelListItemViewModel {
  return "provider" in model;
}

export default function ModelCard({
  model,
  mode,
  installProgress,
  isDetailsExpanded,
  selectedFileIds,
  onToggleDetails,
  onToggleFileSelection,
  onDownloadFile,
  onDownloadFiles,
  onRemove,
}: ModelCardProps): JSX.Element {
  const effectiveMode = mode ?? (isRemoteModel(model) ? "remote" : "installed");
  const [selectedExtension, setSelectedExtension] = useState<string>("all");
  const selectedFiles = model.downloadFiles.filter((file) => selectedFileIds?.includes(file.id));
  const selectedTotalSizeBytes = selectedFiles.reduce(
    (sum, file) => sum + (file.sizeBytes ?? 0),
    0
  );
  const fileExtensions = useMemo(
    () =>
      Object.freeze(
        [...new Set(model.downloadFiles.map((file) => file.extension))].sort((left, right) =>
          left.localeCompare(right)
        )
      ),
    [model.downloadFiles]
  );
  const filteredFiles =
    selectedExtension === "all"
      ? model.downloadFiles
      : model.downloadFiles.filter((file) => file.extension === selectedExtension);
  const downloadProgressLabel = formatDownloadProgress(installProgress);
  const downloadActionLabel = resolveDownloadActionLabel(installProgress);
  const isDownloadBusy = installProgress
    ? !["completed", "failed", "cancelled"].includes(installProgress.status)
    : false;
  const downloadBadgeClass = installProgress
    ? badgeClassForInstallStatus(installProgress.status)
    : "ui-badge--neutral";

  return (
    <article className="ui-card ui-model-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-row ui-row--between" style={{ alignItems: "flex-start" }}>
          <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
            <div className="ui-heading-4" style={{ overflowWrap: "anywhere" }}>
              {model.title}
            </div>
            {model.subtitle ? (
              <div className="ui-text-secondary ui-text-small">{model.subtitle}</div>
            ) : null}
          </div>

          <span
            className={`ui-badge ${
              model.isAvailable ? "ui-badge--success" : "ui-badge--warning"
            }`}
          >
            {model.status}
          </span>
        </div>

        <div className="ui-chips">
          <span className="ui-badge ui-badge--neutral">{model.kind}</span>
          {model.architectureFamily ? (
            <span className="ui-badge ui-badge--model">{model.architectureFamily}</span>
          ) : null}
          {isRemoteModel(model) ? (
            <span className="ui-badge ui-badge--info">{model.provider}</span>
          ) : null}
          {model.requiresAuth ? <span className="ui-badge ui-badge--warning">Auth</span> : null}
        </div>

        <dl className="ui-model-card__summary">
          <div>
            <dt>Publisher</dt>
            <dd>{model.subtitle ?? "â€”"}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{model.reference}</dd>
          </div>
          <div>
            <dt>Primary File</dt>
            <dd>{model.format?.toUpperCase() ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{model.sizeLabel ?? "Unknown"}</dd>
          </div>
        </dl>

        <div className="ui-row ui-row--wrap ui-subtle" style={{ fontSize: "var(--font-size-xs)" }}>
          {!model.isRunnable ? <span>Supporting asset</span> : null}
          {downloadProgressLabel ? (
            <span role="status" aria-live="polite">
              <span className={`ui-badge ${downloadBadgeClass}`}>{downloadActionLabel}</span>{" "}
              {downloadProgressLabel}
            </span>
          ) : null}
        </div>

        {model.taskBadges.length > 0 ? (
          <div className="ui-chips">
            {model.taskBadges.slice(0, 4).map((task) => (
              <span key={task} className="ui-badge ui-badge--neutral">
                {task}
              </span>
            ))}
          </div>
        ) : null}

        {effectiveMode === "remote" ? (
          <>
            <button
              className="ui-button ui-button--secondary ui-button--sm"
              type="button"
              onClick={() => onToggleDetails?.(model.id)}
            >
              {isDetailsExpanded ? "Hide Details" : "Show More Details"}
            </button>

            {isDetailsExpanded ? (
              <section className="ui-model-card__details ui-stack ui-stack--sm">
                <div className="ui-row ui-row--between ui-row--wrap" style={{ alignItems: "center" }}>
                  <div>
                    <div className="ui-text-small ui-text-secondary">Download files</div>
                    <div className="ui-subtle ui-text-small">
                      {selectedFiles.length} selected â€¢ {formatBytes(selectedTotalSizeBytes) ?? "Unknown"}
                    </div>
                  </div>

                  <label className="ui-model-card__filter">
                    <span className="ui-subtle ui-text-small">File type</span>
                    <select
                      className="ui-input"
                      value={selectedExtension}
                      onChange={(event) => setSelectedExtension(event.target.value)}
                    >
                      <option value="all">All</option>
                      {fileExtensions.map((extension) => (
                        <option key={extension} value={extension}>
                          .{extension}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {filteredFiles.map((file) => {
                  const isChecked = selectedFileIds?.includes(file.id) ?? false;

                  return (
                    <div key={file.id} className="ui-model-card__file-row">
                      <label className="ui-model-card__file-select">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleFileSelection?.(model.id, file.id)}
                        />
                        <span className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small ui-model-card__file-name">
                            {file.name}
                            {file.isPrimary ? (
                              <span className="ui-badge ui-badge--neutral ui-model-card__primary-badge">
                                Primary
                              </span>
                            ) : null}
                          </span>
                          <span className="ui-subtle ui-text-small">
                            .{file.extension}
                            {file.sizeLabel ? ` â€¢ ${file.sizeLabel}` : ""}
                          </span>
                        </span>
                      </label>
                      <button
                        className="ui-button ui-button--ghost ui-button--sm"
                        type="button"
                        disabled={isDownloadBusy}
                        onClick={() => onDownloadFile?.(model.id, file)}
                      >
                        {isDownloadBusy ? "Workingâ€¦" : "Download"}
                      </button>
                    </div>
                  );
                })}

                <div className="ui-row ui-row--wrap">
                  <button
                    className="ui-button ui-button--primary ui-button--sm"
                    type="button"
                    disabled={
                      !(isRemoteModel(model) && model.isInstallable) ||
                      selectedFiles.length === 0 ||
                      isDownloadBusy
                    }
                    onClick={() => onDownloadFiles?.(model.id, selectedFiles)}
                  >
                    {selectedFiles.length > 0
                      ? `${downloadActionLabel} Selected`
                      : "Download Selected"}
                  </button>
                  <button
                    className="ui-button ui-button--secondary ui-button--sm"
                    type="button"
                    disabled={
                      !(isRemoteModel(model) && model.isInstallable) ||
                      model.downloadFiles.length === 0 ||
                      isDownloadBusy
                    }
                    onClick={() => onDownloadFiles?.(model.id, model.downloadFiles)}
                  >
                    {downloadActionLabel} All
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {effectiveMode === "installed" ? (
          <button
            className="ui-button ui-button--danger ui-button--sm"
            type="button"
            onClick={() => onRemove?.(model.id)}
          >
            Remove
          </button>
        ) : null}
      </div>
    </article>
  );
}

function formatDownloadProgress(progress?: IModelInstallProgress): string | undefined {
  if (!progress) {
    return undefined;
  }

  const percent = progress.downloadProgress?.percent;
  const message = progress.message ?? progress.downloadProgress?.message;

  if (percent !== undefined) {
    return message ? `${message} (${Math.round(percent)}%)` : `${Math.round(percent)}% complete`;
  }

  return message ?? progress.status;
}

function resolveDownloadActionLabel(progress?: IModelInstallProgress): string {
  switch (progress?.status) {
    case "queued":
    case "preparing":
      return "Preparing";
    case "downloading":
      return "Downloading";
    case "installing":
      return "Installing";
    case "verifying":
      return "Verifying";
    case "completed":
      return "Downloaded";
    case "failed":
      return "Retry";
    case "cancelled":
      return "Cancelled";
    default:
      return "Download";
  }
}

function badgeClassForInstallStatus(status: IModelInstallProgress["status"]): string {
  switch (status) {
    case "completed":
      return "ui-badge--success";
    case "failed":
      return "ui-badge--danger";
    case "cancelled":
      return "ui-badge--warning";
    case "downloading":
    case "installing":
    case "verifying":
      return "ui-badge--info";
    default:
      return "ui-badge--neutral";
  }
}

