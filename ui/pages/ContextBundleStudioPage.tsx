import StudioShellPage from "./StudioShellPage";
import { contextBundleStudioRegistration } from "../studio-shell/registrations/ContextBundleStudioRegistration";

export default function ContextBundleStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={contextBundleStudioRegistration} />;
}
