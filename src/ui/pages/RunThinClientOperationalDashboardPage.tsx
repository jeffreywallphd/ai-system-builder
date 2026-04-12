import type { ReactNode } from "react";
import ThinClientOperationalSurfaceFrame, { type ThinClientSurfaceNotice } from "@ui/web/shell/ThinClientOperationalSurfaceFrame";

export interface RunThinClientOperationalDashboardPageProps {
  readonly notices?: ReadonlyArray<ThinClientSurfaceNotice>;
  readonly navigation?: ReactNode;
  readonly content: ReactNode;
  readonly detail?: ReactNode;
}

export default function RunThinClientOperationalDashboardPage({
  notices = Object.freeze([]),
  navigation,
  content,
  detail,
}: RunThinClientOperationalDashboardPageProps): JSX.Element {
  return (
    <ThinClientOperationalSurfaceFrame
      title="Operational workspace dashboard"
      subtitle="Thin-client operational monitoring and lightweight run control for active workspace execution."
      notices={notices}
      navigation={navigation}
      content={content}
      detail={detail}
    />
  );
}
