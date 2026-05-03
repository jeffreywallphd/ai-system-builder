import { useState } from "react";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

export function ImageGenerationFeature(){
 const [prompt,setPrompt]=useState("a mountain landscape");
 const f=useImageGenerationFeature();
 return <section className="ui-panel ui-stack ui-stack--sm"><h2>Image Generation</h2><div className="ui-grid ui-grid--two"><input className="ui-input" value={prompt} onChange={(e)=>setPrompt(e.target.value)} /><button className="ui-button" onClick={()=>void f.start(prompt)}>Generate</button></div><p>Lifecycle stage: <strong>{f.status}</strong></p>{f.friendlyError ? <p>{f.friendlyError}</p>:null}{f.error ? <details><summary>Technical details</summary><p className="ui-text-muted">{f.error.code}: {f.error.message}</p><p className="ui-text-muted">Endpoint: {f.error.endpoint} ({f.error.httpStatus ?? "n/a"})</p>{f.error.details ? <pre>{JSON.stringify(f.error.details,null,2)}</pre> : null}</details>:null}<div className="ui-grid ui-grid--two">{f.images.map((url)=> <img key={url} src={url} alt="Generated artifact" />)}</div></section>;
}
