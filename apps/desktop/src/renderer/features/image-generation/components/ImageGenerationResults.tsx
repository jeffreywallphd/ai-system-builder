export function ImageGenerationResults({ taskData, finalized }: any) {
  const outputs = taskData?.outputs ?? taskData?.value?.outputs ?? [];
  const assets = finalized?.assets ?? finalized?.value?.assets ?? [];
  return <section className="ui-panel image-gen__section"><h2>Results</h2><p>Preview retrieval is deferred.</p><h3>Output References</h3><ul>{outputs.map((o: any, i: number) => <li key={i}>{o.fileName ?? "(file unknown)"} | {o.subfolder ?? "(subfolder unknown)"} | {o.engine ?? "(engine unknown)"} | {o.promptId ?? "(prompt id n/a)"}</li>)}</ul><h3>Finalized Assets</h3><ul>{assets.map((a: any, i: number) => <li key={i}>{a.assetId} / {a.artifactId}</li>)}</ul></section>;
}
