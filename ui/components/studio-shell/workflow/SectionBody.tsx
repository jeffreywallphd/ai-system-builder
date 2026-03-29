interface SectionBodyProps {
  readonly children: JSX.Element | ReadonlyArray<JSX.Element>;
}

export default function SectionBody({ children }: SectionBodyProps): JSX.Element {
  return <div className="ui-stack ui-stack--2xs">{children}</div>;
}
