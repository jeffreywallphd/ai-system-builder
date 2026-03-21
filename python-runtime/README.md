# AI Loom Studio Python Runtime

FastAPI service that executes Python-native and LangChain-backed workflow nodes.

## Local setup

1. Create virtual environment:
   ```bash
   cd python-runtime
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run service locally:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
   ```

## Local MCP authoring

- The runtime can provision workspace-local MCP tools for AI Loom Studio.
- Those workspace-local tools execute directly from their saved provisioning state inside the runtime, so provisioning no longer performs an automatic `pip install` step.
- If you want to run a generated `server.py` file as a standalone MCP stdio process outside the runtime, install the MCP Python package in that environment first.

## Endpoints

- `GET /health`
- `POST /execute/node`
- `POST /execute/workflow`
- `GET /workflows/capabilities`
