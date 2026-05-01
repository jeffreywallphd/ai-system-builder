import type { ImageGenerationFinalizedAssetReference, ImageGenerationOutputReference } from "../hooks/useImageGenerationFeature";

export function ImageGenerationResults({ outputs, finalizedAssets }: { outputs: ImageGenerationOutputReference[]; finalizedAssets: ImageGenerationFinalizedAssetReference[] }) {
  return <section className="ui-panel ui-stack ui-stack--sm"><h2>Results</h2><p>Preview retrieval is deferred.</p><h3>Output References</h3><ul>{outputs.map((o, i) => <li key={i}>{o.fileName ?? "(file unknown)"} | {o.subfolder ?? "(subfolder unknown)"} | {o.engine ?? "(engine unknown)"} | {o.promptId ?? "(prompt id n/a)"}</li>)}</ul><h3>Finalized Assets</h3><ul>{finalizedAssets.map((a, i) => <li key={i}>{a.assetId} / {a.artifactId}</li>)}</ul></section>;
}
