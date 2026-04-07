import { useLocation } from "react-router-dom";
import StudioShellPage from "./StudioShellPage";
import { resolveSystemBuildTemplate } from "../../application/system-studio/SystemBuildTemplateCatalog";
import { systemStudioRegistration } from "../studio-shell/registrations/SystemStudioRegistration";

export default function SystemStudioPage(): JSX.Element {
  const location = useLocation();
  const buildTemplateId = new URLSearchParams(location.search).get("buildTemplateId")?.trim();
  const selectedTemplate = resolveSystemBuildTemplate(buildTemplateId);

  const registration = selectedTemplate
    ? Object.freeze({
      ...systemStudioRegistration,
      defaults: Object.freeze({
        ...systemStudioRegistration.defaults,
        assetId: selectedTemplate.draftSeed.assetId,
        title: selectedTemplate.draftSeed.title,
        tags: selectedTemplate.draftSeed.tags,
        metadataPatch: selectedTemplate.draftSeed.metadataPatch,
        dependencies: selectedTemplate.draftSeed.dependencies,
        contentTemplate: selectedTemplate.draftSeed.contentTemplate,
      }),
    })
    : systemStudioRegistration;

  return <StudioShellPage studioRegistration={registration} />;
}
