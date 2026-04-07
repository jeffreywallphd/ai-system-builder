import type { ReactNode } from "react";
import DesktopAdminSurfaceFrame, { type DesktopSurfaceNotice } from "@ui/desktop/shell/DesktopAdminSurfaceFrame";

export interface RunDesktopOperationalDashboardPageProps {
  readonly notices?: ReadonlyArray<DesktopSurfaceNotice>;
  readonly navigation?: ReactNode;
  readonly content: ReactNode;
  readonly detail?: ReactNode;
}

export default function RunDesktopOperationalDashboardPage({
  notices = Object.freeze([]),
  navigation,
  content,
  detail,
}: RunDesktopOperationalDashboardPageProps): JSX.Element {
  return (
    <DesktopAdminSurfaceFrame
      title="Operational workspace dashboard"
      subtitle="Workspace-level queue, run, output, node, and alert visibility for desktop operational workflows."
      notices={notices}
      navigation={navigation}
      content={content}
      detail={detail}
    />
  );
}
