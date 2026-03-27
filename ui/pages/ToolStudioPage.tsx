import StudioShellPage from "./StudioShellPage";
import { toolStudioRegistration } from "../studio-shell/registrations/ToolStudioRegistration";

export default function ToolStudioPage(): JSX.Element {
  return <StudioShellPage atomicStudio={toolStudioRegistration} />;
}
