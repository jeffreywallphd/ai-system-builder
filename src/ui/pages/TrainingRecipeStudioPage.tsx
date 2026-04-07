import StudioShellPage from "./StudioShellPage";
import { trainingRecipeStudioRegistration } from "../studio-shell/registrations/TrainingRecipeStudioRegistration";

export default function TrainingRecipeStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={trainingRecipeStudioRegistration} />;
}
