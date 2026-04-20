# Python Runtime Worker

This directory contains the managed Python sidecar worker.

Endpoints:

- `GET /health`
- `GET /capabilities`
- `POST /tasks/execute`

Implemented task:

- `prepare-training-dataset`
  - normalizes supported source docs to markdown (`.txt`, `.md`, `.html`, `.pdf`, `.docx`)
  - explicitly rejects legacy `.doc` files (convert to `.docx` or configure skip policy)
  - chunks markdown using recipe chunking config (`character` strategy)
  - generates QA training examples from chunks via local `transformers` model configuration
  - emits train/test dataset artifacts in JSONL/JSON/CSV using generated-example rows
