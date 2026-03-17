import type { ReactNode } from "react";

export interface AppRouteDefinition {
  readonly key: string;
  readonly path: string;
  readonly title: string;
  readonly requiresAuth?: boolean;
  readonly showInNavigation?: boolean;
  readonly element?: ReactNode;
}

export const ROUTE_PATHS = Object.freeze({
  home: "/",
  workflows: "/workflows",
  workflowEditor: "/workflows/:workflowId",
  tools: "/tools",
  toolRun: "/tools/:toolId",
  models: "/models",
  assets: "/assets",
  notFound: "*",
});

export const APP_ROUTES: ReadonlyArray<AppRouteDefinition> = Object.freeze([
  Object.freeze({
    key: "home",
    path: ROUTE_PATHS.home,
    title: "Home",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "workflows",
    path: ROUTE_PATHS.workflows,
    title: "Workflows",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "workflow-editor",
    path: ROUTE_PATHS.workflowEditor,
    title: "Workflow Editor",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "tools",
    path: ROUTE_PATHS.tools,
    title: "Tools",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "tool-run",
    path: ROUTE_PATHS.toolRun,
    title: "Tool Run",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "models",
    path: ROUTE_PATHS.models,
    title: "Models",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "assets",
    path: ROUTE_PATHS.assets,
    title: "Assets",
    showInNavigation: true,
  }),
]);

export function getNavigationRoutes(): ReadonlyArray<AppRouteDefinition> {
  return APP_ROUTES.filter((route) => route.showInNavigation);
}
