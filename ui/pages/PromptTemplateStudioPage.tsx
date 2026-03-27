import StudioShellPage from "./StudioShellPage";
import { promptTemplateStudioRegistration } from "../studio-shell/registrations/PromptTemplateStudioRegistration";

export default function PromptTemplateStudioPage(): JSX.Element {
  return <StudioShellPage atomicStudio={promptTemplateStudioRegistration} />;
}
