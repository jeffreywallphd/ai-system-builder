import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import StudioShellPage from "./StudioShellPage";
import { workflowStudioRegistration } from "../studio-shell/registrations/WorkflowStudioRegistration";
import { resolveWorkflowStudioModeRoute } from "../studio-shell/workflow/WorkflowStudioModeRouting";
import { resolveWorkflowStudioWizardPageRoute } from "../studio-shell/workflow/WorkflowStudioWizardRouting";

export default function WorkflowStudioPage(): JSX.Element {
  const location = useLocation();
  const routeParams = useParams<{ modeId?: string; wizardPageId?: string }>();
  const workflowModeRoute = useMemo(
    () => resolveWorkflowStudioModeRoute({
      routeModeId: routeParams.modeId ?? (routeParams.wizardPageId ? "wizard" : undefined),
      search: location.search,
    }),
    [location.search, routeParams.modeId, routeParams.wizardPageId],
  );
  const workflowWizardPageRoute = useMemo(
    () => resolveWorkflowStudioWizardPageRoute({
      routePageId: routeParams.wizardPageId,
      search: location.search,
    }),
    [location.search, routeParams.wizardPageId],
  );

  return (
    <StudioShellPage
      studioRegistration={workflowStudioRegistration}
      workflowModeRoute={workflowModeRoute}
      workflowWizardPageRoute={workflowWizardPageRoute}
    />
  );
}
