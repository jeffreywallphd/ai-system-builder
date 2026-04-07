interface SectionHeaderProps {
  readonly title: string;
  readonly description?: string;
}

export default function SectionHeader({
  title,
  description,
}: SectionHeaderProps): JSX.Element {
  return (
    <header className="ui-stack ui-stack--2xs">
      <h3 className="ui-page__subtitle">{title}</h3>
      {description ? <p className="ui-text-muted">{description}</p> : null}
    </header>
  );
}
