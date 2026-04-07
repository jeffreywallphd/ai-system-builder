import type { ReactNode } from "react";
import { SurfaceFrame, SurfaceHeaderBar, type SurfaceHeaderBarProps } from "@ui/shared/components/shell";

export interface ThinClientSurfaceShellProps extends SurfaceHeaderBarProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export default function ThinClientSurfaceShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: ThinClientSurfaceShellProps): JSX.Element {
  return (
    <SurfaceFrame surface="thin" className={className}>
      <SurfaceHeaderBar title={title} subtitle={subtitle} actions={actions} />
      {children}
    </SurfaceFrame>
  );
}
