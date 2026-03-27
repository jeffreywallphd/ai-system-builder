import StudioShellPage from "./StudioShellPage";
import { configProfileStudioRegistration } from "../studio-shell/registrations/ConfigProfileStudioRegistration";

export default function ConfigProfileStudioPage(): JSX.Element {
  return <StudioShellPage atomicStudio={configProfileStudioRegistration} />;
}
