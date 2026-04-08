import type { JSX } from "react";

export type ImageStatusNoticeTone = "neutral" | "warning" | "danger" | "success";

export interface ImageStatusNoticeProps {
  readonly title: string;
  readonly message: string;
  readonly tone?: ImageStatusNoticeTone;
  readonly className?: string;
  readonly loading?: boolean;
}

export function ImageStatusNotice({
  title,
  message,
  tone = "neutral",
  className,
  loading = false,
}: ImageStatusNoticeProps): JSX.Element {
  return (
    <section
      className={[
        "ui-image-surface",
        "ui-image-surface--status",
        "ui-image-status-notice",
        `ui-image-status-notice--${tone}`,
        loading ? "ui-image-status-notice--loading" : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-image-status-notice__loading-bar" aria-hidden="true" /> : null}
      <h4 className="ui-image-status-notice__title">{title}</h4>
      <p className="ui-text-small ui-image-status-notice__message">{message}</p>
    </section>
  );
}

export default ImageStatusNotice;
