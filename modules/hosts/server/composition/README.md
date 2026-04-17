# Server host composition

`composeServerHost` wires server-host lifecycle dependencies while keeping transport setup thin.

Current composition includes:

- artifact-object storage via filesystem adapter,
- local artifact catalog for browse/detail/content metadata seams,
- image upload and artifact browser use cases,
- artifact-repo storage composition with provider dispatch,
- first artifact-repo provider registration: Hugging Face.

The server host keeps artifact-object and artifact-repo storage families as peer capabilities. It does not flatten them into a single universal storage abstraction.
