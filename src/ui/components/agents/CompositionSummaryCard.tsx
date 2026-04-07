import type { AssetContractDescriptor } from "../../../src/domain/contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "../../../src/domain/taxonomy/CompositionTaxonomy";

interface CompositionSummaryCardProps {
  readonly title: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
}

export function CompositionSummaryCard(props: CompositionSummaryCardProps): JSX.Element {
  return (
    <section className="ui-card ui-stack ui-stack--xs" data-testid="composition-summary-card">
      <h4 className="ui-heading-4">{props.title}</h4>
      <div className="ui-row ui-row--wrap">
        <span className="ui-badge ui-badge--neutral">{props.taxonomy.structuralKind}</span>
        <span className="ui-badge ui-badge--neutral">{props.taxonomy.semanticRole}</span>
        <span className="ui-badge ui-badge--neutral">{props.taxonomy.behaviorKind}</span>
      </div>
      {props.contract ? (
        <div className="ui-text-small ui-text-secondary">
          Contract {props.contract.id} v{props.contract.version} ·
          {` input=${props.contract.input.kind}, output=${props.contract.output.kind}, params=${props.contract.parameters.length}`}
        </div>
      ) : (
        <div className="ui-text-small ui-text-secondary">Contract projection unavailable.</div>
      )}
    </section>
  );
}
