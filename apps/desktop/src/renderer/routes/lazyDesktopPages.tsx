import { lazy, type ComponentType, type LazyExoticComponent } from "react";

import { recordRendererMemorySnapshot } from "../diagnostics/rendererMemoryDiagnostics";
import type { ActiveWorkspaceReadinessStatus } from "../features/workspace";
import type { DesktopPageKey } from "./desktopPages";

export interface WorkspaceScopedPageProps {
  readonly workspaceId: string;
  readonly workspaceName: string;
}

export interface ArtifactsLazyPageProps extends WorkspaceScopedPageProps {
  readonly refreshToken: number;
  readonly onUploaded: () => void;
}

export interface HomeLazyPageProps {
  readonly onGoToArtifacts: () => void;
}

export type DesktopLazyPagePropsByKey = {
  readonly home: HomeLazyPageProps;
  readonly artifacts: ArtifactsLazyPageProps;
  readonly assets: WorkspaceScopedPageProps;
  readonly models: WorkspaceScopedPageProps;
  readonly "image-generation": WorkspaceScopedPageProps;
  readonly settings: Record<string, never>;
  readonly system: Record<string, never>;
};

export type DesktopLazyPageComponent<TKey extends DesktopPageKey> = LazyExoticComponent<
  ComponentType<DesktopLazyPagePropsByKey[TKey]>
>;

export type DesktopLazyPageModule<TKey extends DesktopPageKey> = {
  readonly default: ComponentType<DesktopLazyPagePropsByKey[TKey]>;
};

export type DesktopLazyPageLoader<TKey extends DesktopPageKey> = () => Promise<DesktopLazyPageModule<TKey>>;

export type DesktopLazyPageRegistry = {
  readonly [TKey in DesktopPageKey]: DesktopLazyPageComponent<TKey>;
};

export interface DesktopLazyPageDiagnosticContext {
  readonly activePage: DesktopPageKey;
  readonly visibleActivePage?: DesktopPageKey;
  readonly workspaceStatus?: ActiveWorkspaceReadinessStatus;
  readonly routeRequiresWorkspace?: boolean;
}

let desktopLazyPageDiagnosticContext: DesktopLazyPageDiagnosticContext | undefined;

export function setDesktopLazyPageDiagnosticContext(context: DesktopLazyPageDiagnosticContext): void {
  desktopLazyPageDiagnosticContext = context;
}

function createLazyPageDiagnosticDetail(pageKey: DesktopPageKey): Record<string, unknown> {
  return {
    activePage: desktopLazyPageDiagnosticContext?.activePage ?? pageKey,
    visibleActivePage: desktopLazyPageDiagnosticContext?.visibleActivePage,
    workspaceStatus: desktopLazyPageDiagnosticContext?.workspaceStatus,
    routeRequiresWorkspace: desktopLazyPageDiagnosticContext?.routeRequiresWorkspace,
  };
}

function lazyDesktopPage<TKey extends DesktopPageKey>(
  pageKey: TKey,
  loadPage: DesktopLazyPageLoader<TKey>,
): DesktopLazyPageComponent<TKey> {
  return lazy(async () => {
    recordRendererMemorySnapshot({
      milestone: "renderer.page.lazy-load.start",
      component: "desktop-renderer",
      detail: createLazyPageDiagnosticDetail(pageKey),
    });

    try {
      const loadedPage = await loadPage();
      recordRendererMemorySnapshot({
        milestone: "renderer.page.lazy-load.resolved",
        component: "desktop-renderer",
        detail: createLazyPageDiagnosticDetail(pageKey),
      });
      return loadedPage;
    } catch (error) {
      recordRendererMemorySnapshot({
        milestone: "renderer.page.lazy-load.failed",
        component: "desktop-renderer",
        detail: {
          ...createLazyPageDiagnosticDetail(pageKey),
          error: error instanceof Error ? error.message : "unknown lazy page load failure",
        },
      });
      throw error;
    }
  });
}

export function createLazyDesktopPageRegistry(
  loaders: { readonly [TKey in DesktopPageKey]: DesktopLazyPageLoader<TKey> },
): DesktopLazyPageRegistry {
  return {
    home: lazyDesktopPage("home", loaders.home),
    artifacts: lazyDesktopPage("artifacts", loaders.artifacts),
    assets: lazyDesktopPage("assets", loaders.assets),
    models: lazyDesktopPage("models", loaders.models),
    "image-generation": lazyDesktopPage("image-generation", loaders["image-generation"]),
    settings: lazyDesktopPage("settings", loaders.settings),
    system: lazyDesktopPage("system", loaders.system),
  };
}

export const desktopLazyPages = createLazyDesktopPageRegistry({
  home: async () => {
    const module = await import("../pages/HomePage");
    return { default: module.HomePage };
  },
  artifacts: async () => {
    const module = await import("../pages/ArtifactsPage");
    return { default: module.ArtifactsPage };
  },
  assets: async () => {
    const module = await import("../pages/AssetLibraryPage");
    return { default: module.AssetLibraryPage };
  },
  models: async () => {
    const module = await import("../pages/ModelsPage");
    return { default: module.ModelsPage };
  },
  "image-generation": async () => {
    const module = await import("../pages/ImageGenerationPage");
    return { default: module.ImageGenerationPage };
  },
  settings: async () => {
    const module = await import("../pages/SettingsPage");
    return { default: module.SettingsPage };
  },
  system: async () => {
    const module = await import("../pages/SystemPage");
    return { default: module.SystemPage };
  },
});
