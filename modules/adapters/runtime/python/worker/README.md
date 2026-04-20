# Python Runtime Worker

This directory contains the managed Python sidecar worker.

Endpoints:

- `GET /health`
- `GET /capabilities`
- `POST /tasks/execute`

Implemented task:

- `prepare-training-dataset`
  - normalizes supported source docs to markdown (`.txt`, `.md`, `.html`, `.pdf`, `.docx`)
  - chunks markdown using recipe chunking config (`character` strategy)
  - emits interim chunk-level train/test dataset artifacts
