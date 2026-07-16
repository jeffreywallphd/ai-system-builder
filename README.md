# AI System Builder

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

AI System Builder is a TypeScript platform for composing, running, and managing AI-enabled systems. Its clean module boundaries support an Electron desktop application, a server host, and a browser thin client, with deployment designs for local, institution-managed, and cloud environments.

## Start here

- Contributors and coding agents: read [`AGENTS.md`](AGENTS.md), then the [`docs` map](docs/README.md).
- Architecture: start with the [system overview](docs/architecture/system-overview.md) and [module dependency rules](docs/architecture/module-dependency-rules.md).
- Task context: load the [baseline context pack](docs/context/packs/index.pack.md), then use [prompt routing](docs/context/prompt-routing.md).
- Decisions and implementation rules: use the [ADR index](docs/adr/README.md) and [repository standards](docs/standards/).

## Repository shape

- `apps/`: Electron desktop, server, and thin-client delivery surfaces.
- `modules/`: domain, contracts, application, adapter, host, runtime, UI, and shared capabilities.
- `docs/`: canonical decisions, architecture, standards, security guidance, diagnostics, and downstream context packs.
- `dev-tools/`: repository checks, test orchestration, and development utilities.

## Local validation

Install dependencies with `npm install`, then use:

- `npm run docs:check` — documentation and context drift checks.
- `npm run architecture:check` — enforced module dependency direction.
- `npm run agent-support:check` — context catalog and agent-evaluation integrity.
- `npm test` — non-browser unit and integration suite.
- `npm run build:server` — server build.
- `npm run build:thin-client` — thin-client build.
- `npm run dev:desktop`, `npm run dev:server`, or `npm run dev:thin-client` — start a delivery surface.

See the [documentation map](docs/README.md) for authoritative sources and deployment guidance.
