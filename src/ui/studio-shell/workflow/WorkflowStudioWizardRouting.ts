import { ROUTE_PATHS } from "../../routes/RouteConfig";
import {
  WorkflowWizardSectionIds,
  type WorkflowWizardSectionId,
} from "./WorkflowStudioWizardProgress";
import {
  resolveWizardPageRoute,
  type WizardPageRouteContract,
  type WizardPageRouteDefinition,
  type WizardPageRouteResolution,
} from "../wizard/WizardPageRouting";

export const WorkflowStudioWizardPageIds = WorkflowWizardSectionIds;
export type WorkflowStudioWizardPageId = WorkflowWizardSectionId;
export const DEFAULT_WORKFLOW_STUDIO_WIZARD_PAGE_ID: WorkflowStudioWizardPageId = WorkflowStudioWizardPageIds.trigger;
export const workflowStudioWizardPageQueryParam = "wizardPage";

export interface WorkflowStudioWizardPageDefinition extends WizardPageRouteDefinition<WorkflowStudioWizardPageId> {
  readonly summary: string;
}

export const workflowStudioWizardPageDefinitions: ReadonlyArray<WorkflowStudioWizardPageDefinition> = Object.freeze([
  Object.freeze({
    id: WorkflowStudioWizardPageIds.trigger,
    title: "Trigger",
    summary: "Define how workflow execution starts.",
    routeSegment: "trigger",
  }),
  Object.freeze({
    id: WorkflowStudioWizardPageIds.inputs,
    title: "Inputs",
    summary: "Attach datasets and define incoming data requirements.",
    routeSegment: "inputs",
  }),
  Object.freeze({
    id: WorkflowStudioWizardPageIds.steps,
    title: "Steps",
    summary: "Author ordered workflow steps and action behavior.",
    routeSegment: "steps",
  }),
  Object.freeze({
    id: WorkflowStudioWizardPageIds.outputs,
    title: "Outputs",
    summary: "Configure workflow output destinations.",
    routeSegment: "outputs",
  }),
]);

export type WorkflowStudioWizardPageRouteResolution = WizardPageRouteResolution<WorkflowStudioWizardPageId>;

export const workflowStudioWizardPageRouteContract: WizardPageRouteContract<WorkflowStudioWizardPageId> = Object.freeze({
  wizardId: "workflow-studio",
  defaultPageId: DEFAULT_WORKFLOW_STUDIO_WIZARD_PAGE_ID,
  queryParam: workflowStudioWizardPageQueryParam,
  pages: workflowStudioWizardPageDefinitions,
});

export function isWorkflowStudioWizardPageId(value: string): value is WorkflowStudioWizardPageId {
  return workflowStudioWizardPageDefinitions.some((page) => page.id === value);
}

export function resolveWorkflowStudioWizardPageRoute(input: {
  readonly routePageId?: string;
  readonly search?: string;
}): WorkflowStudioWizardPageRouteResolution {
  return resolveWizardPageRoute({
    contract: workflowStudioWizardPageRouteContract,
    routePageId: input.routePageId,
    search: input.search,
  });
}

export function getWorkflowStudioWizardPageDefinition(
  pageId: WorkflowStudioWizardPageId,
): WorkflowStudioWizardPageDefinition | undefined {
  return workflowStudioWizardPageDefinitions.find((page) => page.id === pageId);
}

export function buildWorkflowStudioWizardPagePath(pageId: WorkflowStudioWizardPageId): string {
  return ROUTE_PATHS.workflowStudioWizardPage.replace(":wizardPageId", pageId);
}
