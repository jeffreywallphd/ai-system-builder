export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UploadViewState {
  status: UploadStatus;
  message?: string;
  key?: string;
  mediaType?: string;
  sizeBytes?: number;
}

export interface ImageUploadStatusProps {
  viewState: UploadViewState;
}

export function ImageUploadStatus({ viewState }: ImageUploadStatusProps) {
  return (
    <>
      {viewState.message ? (
        <p
          className={viewState.status === "success" ? "ui-status ui-status--success" : "ui-status"}
          role={viewState.status === "error" ? "alert" : "status"}
        >
          {viewState.message}
        </p>
      ) : null}

      {viewState.status === "success" && viewState.key ? (
        <dl className="ui-grid ui-grid--two">
          <dt>Stored key</dt>
          <dd>{viewState.key}</dd>
          <dt>Stored media type</dt>
          <dd>{viewState.mediaType ?? "unknown"}</dd>
          <dt>Stored size bytes</dt>
          <dd>{viewState.sizeBytes ?? "unknown"}</dd>
        </dl>
      ) : null}
    </>
  );
}
