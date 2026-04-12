import type { ReactNode } from "react";
import {
  DEFAULT_DESKTOP_RESPONSIVE_PROFILE,
  type SurfaceResponsiveProfile,
} from "@ui/shared/responsive";

function joinClasses(...tokens: Array<string | undefined | false>): string {
  return tokens.filter((token): token is string => typeof token === "string" && token.length > 0).join(" ");
}

function toProfile(profile?: SurfaceResponsiveProfile): SurfaceResponsiveProfile {
  return profile ?? DEFAULT_DESKTOP_RESPONSIVE_PROFILE;
}

interface SurfaceResponsivePatternProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly responsiveProfile?: SurfaceResponsiveProfile;
}

export function SurfaceResponsiveTableContainer({
  children,
  className,
  responsiveProfile,
}: SurfaceResponsivePatternProps): JSX.Element {
  const profile = toProfile(responsiveProfile);
  return (
    <section
      className={joinClasses(
        "ui-responsive-pattern",
        "ui-responsive-table",
        `ui-responsive-pattern--density-${profile.density}`,
        `ui-responsive-pattern--interaction-${profile.interactionMode}`,
        className,
      )}
      data-layout={profile.tableLayout}
      data-scroll-region={profile.scrollRegionMode}
    >
      {children}
    </section>
  );
}

export function SurfaceResponsiveFormLayout({
  children,
  className,
  responsiveProfile,
}: SurfaceResponsivePatternProps): JSX.Element {
  const profile = toProfile(responsiveProfile);
  return (
    <section
      className={joinClasses(
        "ui-responsive-pattern",
        "ui-responsive-form",
        `ui-responsive-pattern--density-${profile.density}`,
        `ui-responsive-pattern--interaction-${profile.interactionMode}`,
        className,
      )}
      data-layout={profile.formLayout}
    >
      {children}
    </section>
  );
}

export function SurfaceResponsiveStatusCardGroup({
  children,
  className,
  responsiveProfile,
}: SurfaceResponsivePatternProps): JSX.Element {
  const profile = toProfile(responsiveProfile);
  return (
    <section
      className={joinClasses(
        "ui-responsive-pattern",
        "ui-responsive-status-cards",
        `ui-responsive-pattern--density-${profile.density}`,
        className,
      )}
      data-layout={profile.statusCardLayout}
    >
      {children}
    </section>
  );
}

export function SurfaceResponsiveActionMenuContainer({
  children,
  className,
  responsiveProfile,
}: SurfaceResponsivePatternProps): JSX.Element {
  const profile = toProfile(responsiveProfile);
  return (
    <section
      className={joinClasses(
        "ui-responsive-pattern",
        "ui-responsive-action-menu",
        `ui-responsive-pattern--interaction-${profile.interactionMode}`,
        className,
      )}
      data-layout={profile.actionMenuLayout}
      data-touch-target={profile.minTouchTargetPx}
    >
      {children}
    </section>
  );
}

