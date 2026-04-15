# IPC Electron Transport Adapter

This adapter registers thin Electron IPC handlers that translate IPC transport
requests into application use-case calls and return structured IPC contract
responses.

Current implemented flow:

- `image.upload` request channel registration
- request payload/context delegation into `StoreImageUploadUseCase`
- structured IPC success/failure response mapping on the response channel
