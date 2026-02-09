# Syspoints – System Architecture

## Stack
- Frontend: Vite + React
- Backend: Node.js (REST API)
- Database: PostgreSQL
- Blockchain: Syscoin (hash storage only)

## High-level principles
- Reviews are immutable (cannot be edited or deleted)
- Backend is the source of truth
- Blockchain stores only hashed review metadata
- Points are computed off-chain

## Current focus
Backend review indexer and API

## Environment Configuration

Required environment variables:
- `PORT`
- `DATABASE_URL`
- `RPC_URL`
- `CHAIN_ID`
- `PRIVATE_KEY`

`DATABASE_URL` format example:
```text
postgresql://username:password@host:5432/database_name
```

## API Contract (REST)

All timestamps are ISO-8601 in UTC. All IDs are UUID strings.

### Users

`POST /users`
- Request body:
```json
{
  "wallet_address": "0x...",
  "email": "user@email.com",
  "name": "User",
  "avatar_url": "https://..."
}
```
- Response `201`:
```json
{
  "id": "uuid",
  "wallet_address": "0x...",
  "email": "user@email.com",
  "name": "User",
  "avatar_url": "https://...",
  "created_at": "2026-02-09T12:00:00Z"
}
```
- Errors:
  - `400` validation error
  - `409` email or wallet already exists

### Establishments

`GET /establishments`
- Response `200`:
```json
[
  {
    "id": "uuid",
    "name": "Store",
    "category": "restaurant",
    "created_at": "2026-02-09T12:00:00Z"
  }
]
```

`POST /establishments`
- Request body:
```json
{
  "name": "Store",
  "category": "restaurant"
}
```
- Response `201`:
```json
{
  "id": "uuid",
  "name": "Store",
  "category": "restaurant",
  "created_at": "2026-02-09T12:00:00Z"
}
```
- Errors:
  - `400` validation error

### Reviews

`POST /reviews`
- Request body:
```json
{
  "user_id": "uuid",
  "establishment_id": "uuid",
  "description": "text...",
  "stars": 5,
  "price": 90.5,
  "purchase_url": "https://...",
  "tags": ["tag1", "tag2"],
  "evidence_images": ["https://..."]
}
```
- Response `201`:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "establishment_id": "uuid",
  "description": "text...",
  "stars": 5,
  "price": 90.5,
  "purchase_url": "https://...",
  "tags": ["tag1", "tag2"],
  "evidence_images": ["https://..."],
  "created_at": "2026-02-09T12:00:00Z",
  "points_awarded": 5,
  "review_hash": "hash"
}
```
- Errors:
  - `400` validation error
  - `404` establishment not found
  - `409` review hash already exists

`GET /reviews/:id`
- Response `200`: Review entity
- Errors:
  - `404` not found

## Idempotency and Duplicates

- `POST /reviews` should support `Idempotency-Key` header. If the same key is reused for the same user, the backend returns the original `201` response.
- `review_hash` is unique and should raise `409` on duplicates.
