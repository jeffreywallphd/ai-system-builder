import type { ReactNode } from "react";
import { BuildEntryFeatureFlag } from "../features/BuildEntryFeatureFlag";
import { UxStudioEntryLabelResolver } from "../taxonomy/UxTaxonomySuppression";

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
  login: "/auth/login",
  register: "/auth/register",
  build: "/build",
  buildAutomate: "/build/automate",
  explore: "/explore",
  run: "/run",
  create: "/create",
  compose: "/compose",
  workflows: "/workflows",
  workflowEditor: "/workflows/:workflowId",
  workflowConversation: "/run/workflow-chat/:sessionId",
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
  registry: "/studio-shell/registry",
  registryAssetDetail: "/studio-shell/registry/assets/:assetId",
  workflowStudio: "/studio-shell/workflow",
  workflowStudioRuns: "/studio-shell/workflow/runs",
  workflowStudioRunDetail: "/studio-shell/workflow/runs/:runId",
  workflowStudioMode: "/studio-shell/workflow/:modeId",
  workflowStudioWizardPage: "/studio-shell/workflow/wizard/:wizardPageId",
  contextBundleStudio: "/studio-shell/context-bundle",
  datasetPipelineStudio: "/studio-shell/dataset-pipeline",
  trainingRecipeStudio: "/studio-shell/training-recipe",
  toolChainStudio: "/studio-shell/tool-chain",
  systemStudio: "/studio-shell/system",
  modelStudio: "/studio-shell/model",
  datasetStudio: "/studio-shell/dataset",
  schemaStudio: "/studio-shell/schema",
  toolStudio: "/studio-shell/tool",
  promptTemplateStudio: "/studio-shell/prompt-template",
  embeddingIndexStudio: "/studio-shell/embedding-index",
  configProfileStudio: "/studio-shell/config-profile",
  settings: "/settings",
  identityAdmin: "/settings/identity-admin",
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
    key: "login",
    path: ROUTE_PATHS.login,
    title: "Sign in",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "register",
    path: ROUTE_PATHS.register,
    title: "Create account",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "build",
    path: ROUTE_PATHS.build,
    title: "Build",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "build-automate",
    path: ROUTE_PATHS.buildAutomate,
    title: "Automate a task",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "explore",
    path: ROUTE_PATHS.explore,
    title: "Explore",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "run",
    path: ROUTE_PATHS.run,
    title: "Run",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "create",
    path: ROUTE_PATHS.create,
    title: "Create",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "compose",
    path: ROUTE_PATHS.compose,
    title: "Compose",
    showInNavigation: false,
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
    title: "Legacy Workflow Editor Redirect",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "workflow-conversation",
    path: ROUTE_PATHS.workflowConversation,
    title: "Workflow Conversation",
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
    key: "registry",
    path: ROUTE_PATHS.registry,
    title: "Registry",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "registry-asset-detail",
    path: ROUTE_PATHS.registryAssetDetail,
    title: "Registry Asset Detail",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "workflow-studio",
    path: ROUTE_PATHS.workflowStudio,
    title: "Workflow Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "workflow-studio-runs",
    path: ROUTE_PATHS.workflowStudioRuns,
    title: "Workflow Studio Runs",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "workflow-studio-run-detail",
    path: ROUTE_PATHS.workflowStudioRunDetail,
    title: "Workflow Studio Run Detail",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "workflow-studio-mode",
    path: ROUTE_PATHS.workflowStudioMode,
    title: "Workflow Studio Mode",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "workflow-studio-wizard-page",
    path: ROUTE_PATHS.workflowStudioWizardPage,
    title: "Workflow Studio Wizard Page",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "context-bundle-studio",
    path: ROUTE_PATHS.contextBundleStudio,
    title: "Context Bundle Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "dataset-pipeline-studio",
    path: ROUTE_PATHS.datasetPipelineStudio,
    title: "Dataset Pipeline Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "training-recipe-studio",
    path: ROUTE_PATHS.trainingRecipeStudio,
    title: "Training Recipe Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "tool-chain-studio",
    path: ROUTE_PATHS.toolChainStudio,
    title: "Tool Chain Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "system-studio",
    path: ROUTE_PATHS.systemStudio,
    title: "System Studio",
    showInNavigation: false,
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
    key: "schema-studio",
    path: ROUTE_PATHS.schemaStudio,
    title: "Schema Studio",
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
    key: "embedding-index-studio",
    path: ROUTE_PATHS.embeddingIndexStudio,
    title: "Embedding Index Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "config-profile-studio",
    path: ROUTE_PATHS.configProfileStudio,
    title: "Config Profile Studio",
    showInNavigation: false,
  }),
  Object.freeze({
    key: "settings",
    path: ROUTE_PATHS.settings,
    title: "Settings",
    showInNavigation: true,
  }),
  Object.freeze({
    key: "identity-admin",
    path: ROUTE_PATHS.identityAdmin,
    title: "Identity administration",
    showInNavigation: false,
  }),
]);

export function getNavigationRoutes(): ReadonlyArray<AppRouteDefinition> {
  const labelResolver = new UxStudioEntryLabelResolver();
  const buildFlag = new BuildEntryFeatureFlag();
  return APP_ROUTES
    .filter((route) => {
      if (!route.showInNavigation) {
        return false;
      }
      if (route.key === "build") {
        return buildFlag.isEnabled();
      }
      if (route.key === "workflows" && buildFlag.isEnabled()) {
        return false;
      }
      return true;
    })
    .map((route) => Object.freeze({
      ...route,
      title: labelResolver.resolveNavigationTitle(route.key, route.title),
    }));
}
