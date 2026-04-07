import type { ElementType, ReactNode } from "react";
import { useId } from "react";
import {
  DEFAULT_DESKTOP_RESPONSIVE_PROFILE,
  type SurfaceResponsiveProfile,
} from "@ui/shared/responsive";

function joinClasses(...tokens: Array<string | undefined | false>): string {
  return tokens.filter((token): token is string => typeof token === "string" && token.length > 0).join(" ");
}

export interface SurfaceFrameProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly surface?: "desktop" | "thin" | "shared";
  readonly ariaLabel?: string;
}

export function SurfaceFrame({
  children,
  className,
  surface = "shared",
  ariaLabel,
}: SurfaceFrameProps): JSX.Element {
  return (
    <section
      className={joinClasses("ui-shell", `ui-shell--${surface}`, className)}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}

export interface SurfaceHeaderBarProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly actionsAriaLabel?: string;
}

export function SurfaceHeaderBar({
  title,
  subtitle,
  actions,
  className,
  actionsAriaLabel = "Surface actions",
}: SurfaceHeaderBarProps): JSX.Element {
  return (
    <header className={joinClasses("ui-shell__header", className)}>
      <div className="ui-shell__header-copy">
        <h1 className="ui-shell__title">{title}</h1>
        {subtitle ? <p className="ui-shell__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="ui-shell__actions" role="toolbar" aria-label={actionsAriaLabel}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export interface SurfaceStatusRegionProps {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "success" | "warning" | "danger";
  readonly className?: string;
  readonly politeness?: "off" | "polite" | "assertive";
}

export function SurfaceStatusRegion({
  children,
  tone = "neutral",
  className,
  politeness,
}: SurfaceStatusRegionProps): JSX.Element {
  const ariaLive = politeness ?? (tone === "danger" ? "assertive" : "polite");
  const role = tone === "danger" ? "alert" : "status";
  return (
    <section
      className={joinClasses("ui-shell-status", `ui-shell-status--${tone}`, className)}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      {children}
    </section>
  );
}

export interface SurfaceRegionLayoutProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly collapseOnNarrow?: boolean;
  readonly responsiveProfile?: SurfaceResponsiveProfile;
}

export function SurfaceRegionLayout({
  children,
  className,
  collapseOnNarrow = true,
  responsiveProfile = DEFAULT_DESKTOP_RESPONSIVE_PROFILE,
}: SurfaceRegionLayoutProps): JSX.Element {
  return (
    <div
      className={joinClasses(
        "ui-shell-regions",
        "ui-responsive-panel-layout",
        `ui-responsive-panel-layout--${responsiveProfile.panelLayout}`,
        `ui-responsive-panel-layout--density-${responsiveProfile.density}`,
        `ui-responsive-panel-layout--interaction-${responsiveProfile.interactionMode}`,
        collapseOnNarrow ? "ui-shell-regions--collapse" : undefined,
        className,
      )}
      data-navigation-mode={responsiveProfile.navigationMode}
      data-scroll-region={responsiveProfile.scrollRegionMode}
    >
      {children}
    </div>
  );
}

export interface SurfaceRegionProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: string;
  readonly description?: string;
  readonly ariaLabel?: string;
}

function SurfaceRegionContainer({
  children,
  className,
  title,
  description,
  ariaLabel,
  as,
  defaultAriaLabel,
}: SurfaceRegionProps & {
  readonly roleClassName: string;
  readonly as: ElementType;
  readonly defaultAriaLabel: string;
}): JSX.Element {
  const headingId = useId();
  const Component = as;

  return (
    <Component
      className={joinClasses("ui-shell-region", className)}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : ariaLabel ?? defaultAriaLabel}
    >
      {(title || description) ? (
        <header className="ui-shell-region__header">
          {title ? <h2 id={headingId} className="ui-shell-region__title">{title}</h2> : null}
          {description ? <p className="ui-shell-region__description">{description}</p> : null}
        </header>
      ) : null}
      <div className={joinClasses("ui-shell-region__body", roleClassName)}>
        {children}
      </div>
    </Component>
  );
}

export function SurfaceNavigationRegion(props: SurfaceRegionProps): JSX.Element {
  return (
    <SurfaceRegionContainer
      {...props}
      as="nav"
      defaultAriaLabel="Surface navigation"
      roleClassName="ui-shell-region__body--navigation"
    />
  );
}

export function SurfaceContentRegion(props: SurfaceRegionProps): JSX.Element {
  return (
    <SurfaceRegionContainer
      {...props}
      as="section"
      defaultAriaLabel="Surface content"
      roleClassName="ui-shell-region__body--content"
    />
  );
}

export function SurfaceDetailPane(props: SurfaceRegionProps): JSX.Element {
  return (
    <SurfaceRegionContainer
      {...props}
      as="aside"
      defaultAriaLabel="Surface detail"
      roleClassName="ui-shell-region__body--detail"
    />
  );
}

export interface SurfaceEmptyStateProps {
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export function SurfaceEmptyState({
  title,
  message,
  action,
  className,
}: SurfaceEmptyStateProps): JSX.Element {
  return (
    <div className={joinClasses("ui-shell-empty-state", className)} role="status" aria-live="polite">
      <h2 className="ui-shell-empty-state__title">{title}</h2>
      <p className="ui-shell-empty-state__message">{message}</p>
      {action ? <div className="ui-shell-empty-state__actions">{action}</div> : null}
    </div>
  );
}

export interface PermissionGuardContainerProps {
  readonly isAllowed: boolean;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly unavailable?: boolean;
  readonly unavailableFallback?: ReactNode;
}

export function PermissionGuardContainer({
  isAllowed,
  children,
  fallback,
  unavailable = false,
  unavailableFallback,
}: PermissionGuardContainerProps): JSX.Element {
  if (isAllowed) {
    return <>{children}</>;
  }

  if (unavailable) {
    if (unavailableFallback) {
      return <>{unavailableFallback}</>;
    }

    return (
      <SurfaceEmptyState
        title="Surface unavailable"
        message="This surface is currently unavailable for this host or context."
      />
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <SurfaceEmptyState
      title="Access required"
      message="You do not currently have permission to access this surface."
    />
  );
}
