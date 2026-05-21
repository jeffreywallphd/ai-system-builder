# Desktop host composition

`composeDesktopHost` wires desktop-host lifecycle dependencies while keeping Electron IPC transport thin.

Current composition includes:

- artifact-object storage via filesystem adapter,
- local artifact catalog and storage-binding persistence,
- artifact-browser read + media retrieval use cases,
- artifact-repo storage composition with Hugging Face provider registration.

## Hugging Face token configuration

- `composeDesktopHost` passes `options.artifactRepo.huggingFaceAccessToken` into the Hugging Face adapter.
- If that option is omitted, the adapter falls back to `HF_TOKEN`, then `HUGGING_FACE_TOKEN` in the desktop host environment.
- Desktop renderer artifact-repo operations (`register`, `localize`, `publish`, `verify`) use this host path via preload/IPC and therefore depend on desktop host token configuration for private/gated repositories.
- Public Hugging Face repos may work without a token; private/gated repos surface explicit auth-required (`unavailable`) errors.

## FaceID behavior (Image Generation)

FaceID is optional in the image generation feature. When enabled in the desktop UI, users can select 1-3 uploaded image artifacts as face references and pass FaceID tuning parameters (identity/structure/noise) with the generation request payload.

The managed ComfyUI workflow prepares selected image artifacts into the runtime input directory and uses the first FaceID reference as an image-to-image latent source when no explicit latent reference is selected. This keeps facial retention usable without requiring custom InstantID/InsightFace nodes in the local runtime install.

## Feature lifecycle disposal policy

Desktop host composition keeps core startup services resident and treats feature disposal as an explicit lifecycle concern of host-owned lazy providers. Local foundations such as artifact storage, model registries, asset definitions, settings, workspace shell, logging, diagnostics, and runtime readiness remain resident or warm after first use. Clearly transient features such as artifact remote/Hugging Face adapters, website ingestion, dataset preparation without active tasks, and image generation without active tasks may be disposed by explicit developer action or scoped idle timeout.

Generic disposal must not delete persisted records or files, must not stop Python or ComfyUI, and must not cancel active runtime work. Python process stop, Python model unload, and ComfyUI process/runtime unload remain explicit user/runtime-control paths.
