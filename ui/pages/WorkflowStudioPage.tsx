import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import StudioShellPage from "./StudioShellPage";
import { workflowStudioRegistration } from "../studio-shell/registrations/WorkflowStudioRegistration";
import { resolveWorkflowStudioModeRoute } from "../studio-shell/workflow/WorkflowStudioModeRouting";

export default function WorkflowStudioPage(): JSX.Element {
  const location = useLocation();
  const routeParams = useParams<{ modeId?: string }>();
  const workflowModeRoute = useMemo(
    () => resolveWorkflowStudioModeRoute({
      routeModeId: routeParams.modeId,
      search: location.search,
    }),
    [location.search, routeParams.modeId],
  );

  return (
    <StudioShellPage
      studioRegistration={workflowStudioRegistration}
      workflowModeRoute={workflowModeRoute}
    />
  );
}
