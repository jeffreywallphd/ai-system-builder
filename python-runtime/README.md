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

## Endpoints

- `GET /health`
- `POST /execute/node`
- `POST /execute/workflow`
- `GET /workflows/capabilities`
