import StudioShellPage from "./StudioShellPage";
import { schemaStudioRegistration } from "../studio-shell/registrations/SchemaStudioRegistration";

export default function SchemaStudioPage(): JSX.Element {
  return <StudioShellPage studioRegistration={schemaStudioRegistration} />;
}
