import { recordRendererMemorySnapshot } from "./rendererMemoryDiagnostics";

export type SectionLoadMilestone =
  | "renderer.section.load.start"
  | "renderer.section.load.resolved"
  | "renderer.section.load.failed"
  | "renderer.section.load.skipped"
  | "renderer.section.load.retry";

export interface SectionLoadDiagnosticDetail {
  readonly pageKey: string;
  readonly sectionKey: string;
  readonly trigger: string;
  readonly activePage?: string;
  readonly workspaceStatus?: string;
}

export function recordSectionLoadMilestone(
  milestone: SectionLoadMilestone,
  detail: SectionLoadDiagnosticDetail,
): Record<string, unknown> | undefined {
  return recordRendererMemorySnapshot({
    milestone,
    component: "desktop-renderer-section-loader",
    detail: { ...detail },
  });
}
