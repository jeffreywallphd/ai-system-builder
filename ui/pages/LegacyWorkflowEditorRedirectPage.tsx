import { Navigate, useParams } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { buildWorkflowStudioOpenExistingPath } from "../studio-shell/workflow/WorkflowStudioEntryRouting";

export default function LegacyWorkflowEditorRedirectPage(): JSX.Element {
  const routeParams = useParams<{ workflowId?: string }>();
  const workflowId = routeParams.workflowId?.trim();

  if (!workflowId || workflowId === "new") {
    return <Navigate to={ROUTE_PATHS.workflowStudio} replace />;
  }

  return <Navigate to={buildWorkflowStudioOpenExistingPath(workflowId)} replace />;
}
