import StudioShellPage from "./StudioShellPage";
import { embeddingIndexStudioRegistration } from "../studio-shell/registrations/EmbeddingIndexStudioRegistration";

export default function EmbeddingIndexStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={embeddingIndexStudioRegistration} />;
}
