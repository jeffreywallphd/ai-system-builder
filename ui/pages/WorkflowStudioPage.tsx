import StudioShellPage from "./StudioShellPage";
import { workflowStudioRegistration } from "../studio-shell/registrations/WorkflowStudioRegistration";

export default function WorkflowStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={workflowStudioRegistration} />;
}
