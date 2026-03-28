import StudioShellPage from "./StudioShellPage";
import { systemStudioRegistration } from "../studio-shell/registrations/SystemStudioRegistration";

export default function SystemStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={systemStudioRegistration} />;
}
