import type { JSX } from "react";

export type ImageStatusNoticeTone = "neutral" | "warning" | "danger" | "success";

export interface ImageStatusNoticeProps {
  readonly title: string;
  readonly message: string;
  readonly tone?: ImageStatusNoticeTone;
  readonly className?: string;
}

export function ImageStatusNotice({
  title,
  message,
  tone = "neutral",
  className,
}: ImageStatusNoticeProps): JSX.Element {
  return (
    <section
      className={[
        "ui-image-surface",
        "ui-image-surface--status",
        "ui-image-status-notice",
        `ui-image-status-notice--${tone}`,
        className ?? "",
      ].filter(Boolean).join(" ")}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <h4 className="ui-image-status-notice__title">{title}</h4>
      <p className="ui-text-small ui-image-status-notice__message">{message}</p>
    </section>
  );
}

export default ImageStatusNotice;
