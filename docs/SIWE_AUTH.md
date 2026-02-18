# SIWE Authentication Flow (Syspoints)

Syspoints uses EIP-4361 Sign-In With Ethereum (SIWE) for wallet-based authentication.

## Endpoints

- `GET /auth/siwe/nonce?address=0x...&chain_id=5700&domain=app.example.com&uri=https://app.example.com`
- `POST /auth/siwe/verify`

Request body for verify:

```json
{
  "message": "app.example.com wants you to sign in with your Ethereum account:\n0xAbC...\n\nSign in to Syspoints with your wallet.\nURI: https://app.example.com\nVersion: 1\nChain ID: 5700\nNonce: 8f1b...\nIssued At: 2026-02-18T15:23:14.000Z\nExpiration Time: 2026-02-18T15:28:14.000Z",
  "signature": "0x..."
}
```

## Security Controls

- One-time nonce (`auth_nonces`) with expiration and consumption timestamp.
- Replay protection: nonce is consumed atomically and cannot be reused.
- Domain + chain + URI validation in backend.
- JWT session (`auth_sessions`) with `jti` checked by middleware on protected routes.
- No private keys or signatures are persisted.

## Data Model

- `users`: business entity.
- `wallets`: cryptographic identities linked to users.
- `auth_nonces`: SIWE nonce lifecycle.
- `auth_sessions`: JWT session tracking and revocation-ready store.

## Required Environment Variables

- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `1h`)
- `SIWE_CHAIN_ID` (recommended)
- `SIWE_DOMAIN` or `SIWE_ALLOWED_DOMAINS` (recommended)
- `DEFAULT_USER_AVATAR_URL` (optional)
