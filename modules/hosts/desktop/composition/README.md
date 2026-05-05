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

## FaceID runtime prerequisites (Image Generation)

FaceID is optional in the image generation feature. When enabled in the desktop UI, users can select 1-3 uploaded image artifacts as face references and pass FaceID tuning parameters (identity/structure/noise) with the generation request payload.

ComfyUI runtime requirement:
- Install `ComfyUI_InstantID` custom node in `ComfyUI/custom_nodes/ComfyUI_InstantID`.
- Place InstantID model files under `ComfyUI/models/instantid`.
- Place InsightFace antelopev2 files under `ComfyUI/models/insightface/models/antelopev2`.

If automatic plugin/model installation is unavailable in the running environment, the desktop image-generation form shows inline guidance with these paths.
