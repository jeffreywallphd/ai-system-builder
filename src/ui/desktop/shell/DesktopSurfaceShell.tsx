import type { ReactNode } from "react";
import { SurfaceFrame, SurfaceHeaderBar, type SurfaceHeaderBarProps } from "@ui/shared/components/shell";

export interface DesktopSurfaceShellProps extends SurfaceHeaderBarProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export default function DesktopSurfaceShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: DesktopSurfaceShellProps): JSX.Element {
  return (
    <SurfaceFrame surface="desktop" className={className} ariaLabel={`${title} desktop surface`}>
      <SurfaceHeaderBar title={title} subtitle={subtitle} actions={actions} />
      {children}
    </SurfaceFrame>
  );
}
