import StudioShellPage from "./StudioShellPage";
import { toolChainStudioRegistration } from "../studio-shell/registrations/ToolChainStudioRegistration";

export default function ToolChainStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={toolChainStudioRegistration} />;
}
