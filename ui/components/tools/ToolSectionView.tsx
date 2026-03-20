import type { ToolSection } from "../../../application/projection/models/ToolSection";
import type { InstalledModelOption } from "../../models/buildInstalledModelOptions";
import ProjectedSectionCard from "../projection/ProjectedSectionCard";

export default function ToolSectionView({
  section,
  onChange,
  availableModels,
}: {
  readonly section: ToolSection;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableModels?: ReadonlyArray<InstalledModelOption>;
}): JSX.Element {
  return <ProjectedSectionCard section={section} onChange={onChange} availableModels={availableModels} />;
}
