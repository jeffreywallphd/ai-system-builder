# IPC Contracts

IPC contracts specialize the shared transport contract core for desktop host
message boundaries.

This family keeps the contract surface thin:

- channel naming/value shapes (`ipc-channel`)
- operation and metadata aliases from transport core (`ipc-operation`)
- IPC request/error/response envelopes that preserve transport-core semantics

These contracts are intentionally serialization-friendly and avoid preload,
registration, or `ipcMain`/`ipcRenderer` mechanics. Those details belong in
adapter implementations, not in shared contracts.
