import StudioShellPage from "./StudioShellPage";
import { datasetPipelineStudioRegistration } from "../studio-shell/registrations/DatasetPipelineStudioRegistration";

export default function DatasetPipelineStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={datasetPipelineStudioRegistration} />;
}
