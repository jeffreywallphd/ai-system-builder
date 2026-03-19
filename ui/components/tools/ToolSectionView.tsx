import type { ToolSection } from "../../../application/projection/models/ToolSection";
import ProjectedSectionCard from "../projection/ProjectedSectionCard";

export default function ToolSectionView({
  section,
  onChange,
}: {
  readonly section: ToolSection;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return <ProjectedSectionCard section={section} onChange={onChange} />;
}
