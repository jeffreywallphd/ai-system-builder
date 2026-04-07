export {
  PermissionGuardContainer,
  SurfaceContentRegion,
  SurfaceDetailPane,
  SurfaceEmptyState,
  SurfaceFrame,
  SurfaceHeaderBar,
  SurfaceNavigationRegion,
  SurfaceRegionLayout,
  SurfaceStatusRegion,
} from "./SurfaceShellPrimitives";

export type {
  PermissionGuardContainerProps,
  SurfaceEmptyStateProps,
  SurfaceFrameProps,
  SurfaceHeaderBarProps,
  SurfaceRegionLayoutProps,
  SurfaceRegionProps,
  SurfaceStatusRegionProps,
} from "./SurfaceShellPrimitives";

export {
  SurfaceStateBoundary,
  SurfaceStatePanel,
} from "../presentation-state";

export {
  createEmptyState,
  createLoadingState,
  toDisconnectedState,
  toSurfacePresentationStateFromApiError,
} from "../presentation-state";

export type {
  SurfaceApiErrorLike,
  SurfacePresentationState,
  SurfacePresentationStateKind,
} from "../presentation-state";
