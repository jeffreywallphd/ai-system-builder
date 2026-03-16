export default function AssetsPage(): JSX.Element {
  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Assets</h1>
          <p className="ui-page__subtitle">
            Browse generated and stored workflow assets.
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body">
          <p className="ui-text-secondary">
            This page will host asset listings, previews, and metadata inspection.
          </p>
        </div>
      </div>
    </section>
  );
}
