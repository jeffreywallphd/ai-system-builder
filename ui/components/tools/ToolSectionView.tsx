import type { ToolSection } from "../../../application/projection/models/ToolSection";
import ToolFieldView from "./ToolFieldView";

export default function ToolSectionView({ section, onChange }: { readonly section: ToolSection; readonly onChange: (id: string, value: unknown) => void }): JSX.Element {
  return <section className="ui-card"><div className="ui-card__body ui-stack"><h3>{section.title}</h3>{section.fields.map((field) => <ToolFieldView key={field.id} field={field} onChange={onChange} />)}</div></section>;
}
