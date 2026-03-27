import StudioShellPage from "./StudioShellPage";
import { modelStudioRegistration } from "../studio-shell/registrations/ModelStudioRegistration";

export default function ModelStudioPage(): JSX.Element {
  return <StudioShellPage atomicStudio={modelStudioRegistration} />;
}
