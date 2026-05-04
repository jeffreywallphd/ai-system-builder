# Manual Security Smoke Test

## disabled-dev smoke

1. Start server:
   ```bash
   AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev npm run dev:server
   ```
2. Confirm startup log clearly shows disabled/insecure mode.
3. Start thin-client.
4. Confirm security UI indicates disabled-dev/insecure state.
5. Confirm model management, image generation, and artifact browser requests work without pairing.

## lan-https-token smoke

1. Generate or provide cert/key.
   Example with mkcert:
   ```bash
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   ```
2. Start server with HTTPS required:
   ```bash
   AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token \
   AI_SYSTEM_BUILDER_TLS_CERT_PATH=/path/to/cert.pem \
   AI_SYSTEM_BUILDER_TLS_KEY_PATH=/path/to/key.pem \
   SERVER_TOKEN_HASH_SECRET=<strong-random-secret> \
   npm run dev:server
   ```
3. Confirm server starts in HTTPS mode and does not fall back to HTTP.
4. Start thin-client against HTTPS server.
5. Confirm security UI shows unpaired state.
6. Try protected API before pairing; expect `401` and pairing guidance.
7. Complete pairing via valid pairing code.
8. Confirm bearer token is not displayed in UI.
9. Confirm model/image/artifact requests succeed with Authorization header when scope permits.
10. Confirm an action without required scope returns `403` and permission guidance.
11. Confirm logs do **not** contain:
    - bearer token
    - Authorization header values
    - pairing code
    - TLS private key contents


12. Verify startup fails with an actionable error if `SERVER_TOKEN_HASH_SECRET` is missing in `lan-https-token`.
13. In `disabled-dev`, verify warning indicates insecure fallback is being used when `SERVER_TOKEN_HASH_SECRET` is unset.
