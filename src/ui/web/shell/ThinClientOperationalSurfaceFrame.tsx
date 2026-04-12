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
import ThinClientSurfaceShell from "./ThinClientSurfaceShell";

export interface ThinClientSurfaceNotice {
  readonly tone: "neutral" | "success" | "warning" | "danger";
  readonly content: ReactNode;
}

export interface ThinClientOperationalSurfaceFrameProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly isAllowed?: boolean;
  readonly unavailable?: boolean;
  readonly notices?: ReadonlyArray<ThinClientSurfaceNotice>;
  readonly navigation?: ReactNode;
  readonly content: ReactNode;
  readonly detail?: ReactNode;
}

export default function ThinClientOperationalSurfaceFrame({
  title,
  subtitle,
  actions,
  isAllowed = true,
  unavailable = false,
  notices = Object.freeze([]),
  navigation,
  content,
  detail,
}: ThinClientOperationalSurfaceFrameProps): JSX.Element {
  const responsiveProfile = useSurfaceResponsiveProfile({
    preferDesktopComfortableDensity: true,
  });

  return (
    <ThinClientSurfaceShell title={title} subtitle={subtitle} actions={actions}>
      <PermissionGuardContainer
        isAllowed={isAllowed}
        unavailable={unavailable}
        fallback={(
          <SurfaceEmptyState
            title="Access required"
            message="Your current session cannot access this thin-client operational surface."
          />
        )}
      >
        {notices.map((notice, index) => (
          <SurfaceStatusRegion key={`${notice.tone}-${index}`} tone={notice.tone}>
            {notice.content}
          </SurfaceStatusRegion>
        ))}

        <SurfaceRegionLayout responsiveProfile={responsiveProfile}>
          {navigation ? (
            <SurfaceNavigationRegion title="Context">
              {navigation}
            </SurfaceNavigationRegion>
          ) : null}
          <SurfaceContentRegion title="Operations">
            {content}
          </SurfaceContentRegion>
          {detail ? (
            <SurfaceDetailPane title="Insights">
              {detail}
            </SurfaceDetailPane>
          ) : null}
        </SurfaceRegionLayout>
      </PermissionGuardContainer>
    </ThinClientSurfaceShell>
  );
}
