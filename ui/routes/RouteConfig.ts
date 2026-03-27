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
  workflowContextWorkbench: "/workflows/:workflowId/context-workbench",
  tools: "/tools",
  toolRun: "/tools/:toolId",
  models: "/models",
  context: "/context",
  mcp: "/mcp",
  services: "/services",
  assets: "/assets",
  agentStudio: "/agent-studio",
  studioShell: "/studio-shell",
  modelStudio: "/studio-shell/model",
  datasetStudio: "/studio-shell/dataset",
  toolStudio: "/studio-shell/tool",
  promptTemplateStudio: "/studio-shell/prompt-template",
  settings: "/settings",
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
    key: "workflow-context-workbench",
    path: ROUTE_PATHS.workflowContextWorkbench,
    title: "Context Workbench",
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
    key: "context",
    path: ROUTE_PATHS.context,
    title: "Context",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "mcp",
    path: ROUTE_PATHS.mcp,
    title: "MCP",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "services",
    path: ROUTE_PATHS.services,
    title: "Services",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "assets",
    path: ROUTE_PATHS.assets,
    title: "Assets",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "agent-studio",
    path: ROUTE_PATHS.agentStudio,
    title: "Agent Studio",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "studio-shell",
    path: ROUTE_PATHS.studioShell,
    title: "Studio Shell",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "model-studio",
    path: ROUTE_PATHS.modelStudio,
    title: "Model Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "dataset-studio",
    path: ROUTE_PATHS.datasetStudio,
    title: "Dataset Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "tool-studio",
    path: ROUTE_PATHS.toolStudio,
    title: "Tool Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "prompt-template-studio",
    path: ROUTE_PATHS.promptTemplateStudio,
    title: "Prompt Template Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "settings",
    path: ROUTE_PATHS.settings,
    title: "Settings",
    showInNavigation: true,
  }),
]);

export function getNavigationRoutes(): ReadonlyArray<AppRouteDefinition> {
  return APP_ROUTES.filter((route) => route.showInNavigation);
}
