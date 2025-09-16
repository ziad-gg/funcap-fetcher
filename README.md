# Arkose fetch

A tiny Express + Playwright service that opens the Arkose iframe for a given `public_key`, hooks into crypto calls, intercepts the `/public_key/…` POST, decrypts `bda`, and returns useful artifacts (e.g., `pki_key`, `bda`, `ark-build-id`, `capi_version`).

Built for quick

---

## How it works (high level)

1. Launches a fresh Chromium context via Playwright.
2. Injects your `install.js` init script to hook crypto and expose `window.cryptoLog`.
3. Listens for:
   - `SubtleCrypto.importKey`: captures 294-byte SPKI → `pki_key` (base64).
   - Large `encrypt` payloads → `VM_bda` (base64).
   - Network `POST` to `/public_key/…`: reads headers & form body, decrypts `bda` using `crypt.decrypt(bda_utf, agent + time)`, captures `ark-build-id` and `capi_version`.
4. Returns a JSON with whatever was captured before timeout.

---

## Requirements

- **Node.js** 18+ (recommended)
- **Playwright** with Chromium
- Your local modules:
  - `./install.js` — the init script injected with `context.addInitScript`
  - `./utils.js` — must export `reviveDeep`, `asBytes`, `parseFormData`
  - `./crypt.js` — must export `decrypt(plaintext, key)`

---

## Install

```bash
# 1) Install deps
npm i 
# 2) Install Chromium for Playwright (first time only)
npx playwright install chromium
```

> If you use `pnpm`/`yarn`, adjust accordingly.

---

## Run

```bash
node server.js
```

---

## API

### `GET /fetch?public_key=<ARKOSE_PUBLIC_KEY>`

**Query params**
- `public_key` *(required)*: site key (public key).

**Success response (example)**

```json
{
  "capi": "2.17.1",
  "hash": "FUCK MONKEY",
  "bda": "YmRhX2R... (base64, decrypted or VM_bda)",
  "pki_key": "MIIBIjANB... (base64)",
  "ark-build-id": "d59f20ab-9b70-41d4-a323-641fda28b545"
}
```

**Timeout**
```json
{ "error": "Timeout" }
```

**Server error**
```json
{ "error": "Internal Server Error" }
```

---

## Troubleshooting

- **Stuck at “Loading…” or timeout**  
  Increase the timeout to e.g. `8000` ms. Some keys render slowly, or geo/CDN adds latency.

- **Chromium not found**  
  Run `npx playwright install chromium`.

- **No `pki_key`**  
  Hook might not be firing on your target flow/version. Confirm your `install.js` correctly wraps `SubtleCrypto.importKey` and forwards args to `window.cryptoLog`.

- **`bda` not decrypting**  
  Ensure `crypt.decrypt()` is correct for the current `capi_version`. The key derivation is `agent + time` (from headers).

---

## Security & hygiene tips

- Run in an isolated environment; this service launches a browser on demand.
- Consider rate limiting or IP allow-listing.
- Avoid logging raw decrypted secrets in production logs.
- Always close contexts (`await context.close()`) to prevent leaks.

---

## License

MIT (or your choice). Include an attribution if you distribute modified versions.
