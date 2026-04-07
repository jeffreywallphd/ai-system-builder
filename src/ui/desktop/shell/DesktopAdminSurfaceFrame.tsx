import type { ReactNode } from "react";
import {
  PermissionGuardContainer,
  SurfaceContentRegion,
  SurfaceDetailPane,
  SurfaceEmptyState,
  SurfaceNavigationRegion,
  SurfaceRegionLayout,
  SurfaceStatusRegion,
} from "@ui/shared/components/shell";
import { useSurfaceResponsiveProfile } from "@ui/shared/responsive";
import DesktopSurfaceShell from "./DesktopSurfaceShell";

export interface DesktopSurfaceNotice {
  readonly tone: "neutral" | "success" | "warning" | "danger";
  readonly content: ReactNode;
}

export interface DesktopAdminSurfaceFrameProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly isAllowed?: boolean;
  readonly unauthorizedMessage?: string;
  readonly notices?: ReadonlyArray<DesktopSurfaceNotice>;
  readonly navigation?: ReactNode;
  readonly content: ReactNode;
  readonly detail?: ReactNode;
}

export default function DesktopAdminSurfaceFrame({
  title,
  subtitle,
  actions,
  isAllowed = true,
  unauthorizedMessage = "You do not currently have permission to access this administrative surface.",
  notices = Object.freeze([]),
  navigation,
  content,
  detail,
}: DesktopAdminSurfaceFrameProps): JSX.Element {
  const responsiveProfile = useSurfaceResponsiveProfile();

  return (
    <DesktopSurfaceShell title={title} subtitle={subtitle} actions={actions}>
      <PermissionGuardContainer
        isAllowed={isAllowed}
        fallback={<SurfaceEmptyState title="Access required" message={unauthorizedMessage} />}
      >
        {notices.map((notice, index) => (
          <SurfaceStatusRegion key={`${notice.tone}-${index}`} tone={notice.tone}>
            {notice.content}
          </SurfaceStatusRegion>
        ))}

        <SurfaceRegionLayout responsiveProfile={responsiveProfile}>
          {navigation ? (
            <SurfaceNavigationRegion title="Navigation">
              {navigation}
            </SurfaceNavigationRegion>
          ) : null}
          <SurfaceContentRegion title="Workspace">
            {content}
          </SurfaceContentRegion>
          {detail ? (
            <SurfaceDetailPane title="Detail">
              {detail}
            </SurfaceDetailPane>
          ) : null}
        </SurfaceRegionLayout>
      </PermissionGuardContainer>
    </DesktopSurfaceShell>
  );
}
