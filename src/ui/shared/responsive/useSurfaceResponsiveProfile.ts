import { useEffect, useMemo, useState } from "react";
import {
  createSurfaceResponsiveProfile,
  DEFAULT_DESKTOP_RESPONSIVE_PROFILE,
  type SurfaceResponsiveProfile,
} from "./SurfaceResponsiveTokens";

export interface UseSurfaceResponsiveProfileOptions {
  readonly preferDesktopComfortableDensity?: boolean;
}

function toViewportWidth(): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.innerWidth;
}

export function useSurfaceResponsiveProfile(
  options: UseSurfaceResponsiveProfileOptions = {},
): SurfaceResponsiveProfile {
  const [viewportWidth, setViewportWidth] = useState<number | null>(() => toViewportWidth());

  useEffect(() => {
    const syncViewportWidth = (): void => {
      setViewportWidth(toViewportWidth());
    };
    syncViewportWidth();

    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("resize", syncViewportWidth);
    window.addEventListener("orientationchange", syncViewportWidth);
    return () => {
      window.removeEventListener("resize", syncViewportWidth);
      window.removeEventListener("orientationchange", syncViewportWidth);
    };
  }, []);

  return useMemo(() => {
    if (viewportWidth === null) {
      return DEFAULT_DESKTOP_RESPONSIVE_PROFILE;
    }

    return createSurfaceResponsiveProfile({
      viewportWidthPx: viewportWidth,
      preferDesktopComfortableDensity: options.preferDesktopComfortableDensity,
    });
  }, [options.preferDesktopComfortableDensity, viewportWidth]);
}

