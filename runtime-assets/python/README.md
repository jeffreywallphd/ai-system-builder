# Private Python runtime assets

Packaged desktop builds look for a private Python distribution at:

- `runtime-assets/python/<platform>-<arch>/python/bin/python3` on macOS/Linux
- `runtime-assets/python/<platform>-<arch>/python/python.exe` on Windows

Place the embedded runtime and optional `manifest.json` under that folder before running `npm run make:desktop`.
