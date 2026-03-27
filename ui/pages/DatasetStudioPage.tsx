import StudioShellPage from "./StudioShellPage";
import { datasetStudioRegistration } from "../studio-shell/registrations/DatasetStudioRegistration";

export default function DatasetStudioPage(): JSX.Element {
  return <StudioShellPage atomicStudio={datasetStudioRegistration} />;
}
