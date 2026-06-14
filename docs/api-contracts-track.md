# Track 30 — API contracts + architecture docs alignment

**Status:** complete

Tracks 2–29 shipped mock API, `craft-api`, and realtime services, but architecture docs still said **(planned)** and there was no single contract regression gate.

## Goals

- **`src/lib/apiEnvelope.ts`** — shared `{ data }` / `{ error }` envelope parsers.
- **`src/lib/apiContractManifest.ts`** — canonical mock route files + `craft-api` route markers.
- **`npm run verify:api-contracts`** — offline regression (envelopes + route presence + doc status).
- Refresh **`api-contracts.md`**, **`backend-architecture.md`**, **`database-schema.md`**, **`realtime-collaboration.md`** to reflect implemented stack.

## Verification

```bash
npm run verify:api-contracts
npm test -- src/lib/__tests__/apiContracts.test.ts
npm run verify:stack
```

## See also

- [api-contracts.md](./api-contracts.md) — REST shapes under `/v1`
- [tracks.md](./tracks.md) — master index
