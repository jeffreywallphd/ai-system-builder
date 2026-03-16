import "./PageStyles.css";

export default function AssetsPage(): JSX.Element {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <h1 className="page-title">Assets</h1>
          <p className="page-subtitle">
            Browse generated and stored workflow assets.
          </p>
        </div>
      </div>

      <div className="page-card">
        <p>
          This page will host asset listings, previews, and metadata inspection.
        </p>
      </div>
    </section>
  );
}
