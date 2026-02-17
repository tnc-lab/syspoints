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
- `CONTRACT_ADDRESS`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default 1h)

`DATABASE_URL` format example:
```text
postgresql://username:password@host:5432/database_name
```

## API Contract (REST)

All timestamps are ISO-8601 in UTC. All IDs are UUID strings.

### Health

`GET /health`
- Response `200`:
```json
{ "status": "ok" }
```

`GET /health/db`
- Response `200`:
```json
{ "status": "ok", "db": "up" }
```
- Response `500`:
```json
{ "status": "error", "db": "down" }
```

## Authentication

### Wallet-signature login

`POST /auth/nonce`
- Request body:
```json
{ "wallet_address": "0x..." }
```
- Response `200`:
```json
{
  "user_id": "uuid",
  "wallet_address": "0x...",
  "nonce": "random",
  "expires_at": "2026-02-09T12:00:00Z"
}
```
- Errors:
  - `400` validation error

`POST /auth/token`
- Request body:
```json
{
  "wallet_address": "0x...",
  "signature": "0x..."
}
```
- Signature message format:
```
Syspoints login nonce: <nonce>
```
- Response `200`:
```json
{
  "access_token": "jwt",
  "token_type": "Bearer",
  "expires_in": "1h"
}
```
- Errors:
  - `400` validation error
  - `401` invalid signature or nonce

Notes:
- Authentication is wallet-only.
- Nonce response is always 200 to reduce user enumeration.

### Protected endpoints
Require `Authorization: Bearer <token>`:
- `GET /users` (admin)
- `POST /establishments` (admin)
- `PUT /establishments/:id` (admin)
- `POST /establishments/upload-image` (authenticated user)
- `POST /reviews`
- `POST /reviews/upload-evidence`
- `POST /syscoin/review-hash`
- `GET /admin/points-config` (admin)
- `PUT /admin/points-config` (admin)
- `POST /admin/points-config/default-avatar` (admin)

Role-based access
- `admin` users can create/edit establishments manually, list users, and update points config.
- `user` and `admin` can create reviews.
- Reviews list is public.
- Establishments can also be auto-resolved from OSM location search flow (`POST /establishments/resolve`).

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

`GET /users`
- Response `200`:
```json
[
  {
    "id": "uuid",
    "wallet_address": "0x...",
    "email": "user@email.com",
    "name": "User",
    "avatar_url": "https://...",
    "created_at": "2026-02-09T12:00:00Z"
  }
]
```

### Establishments

`GET /establishments`
- Response `200`:
```json
[
{
  "id": "uuid",
  "name": "Store",
  "category": "restaurant",
  "image_url": "https://.../uploads/establishments/file.jpg",
  "address": "Av. Larco 345, Miraflores, Lima, Peru",
  "country": "Peru",
  "state_region": "Lima",
  "district": "Miraflores",
  "latitude": -12.123,
  "longitude": -77.03,
  "created_at": "2026-02-09T12:00:00Z"
}
]
```

`POST /establishments/search-location`
- Purpose: search candidate establishments via OSM (Nominatim) by name/address text.
- Request body:
```json
{
  "query": "Saga Falabella Av. Larco 345, Miraflores",
  "limit": 6
}
```
- Response `200`:
```json
{
  "data": [
    {
      "id": "123456789",
      "name": "Saga Falabella",
      "address": "Av. Larco 345, Miraflores, Lima, Peru",
      "country": "Peru",
      "state_region": "Lima",
      "district": "Miraflores",
      "latitude": -12.123,
      "longitude": -77.03
    }
  ]
}
```

`POST /establishments/resolve`
- Purpose: create or reuse an establishment by `name + address` (deduplicated by both values).
- Request body:
```json
{
  "name": "Saga Falabella",
  "category": "Retail",
  "address": "Av. Larco 345, Miraflores, Lima, Peru",
  "country": "Peru",
  "state_region": "Lima",
  "district": "Miraflores",
  "latitude": -12.123,
  "longitude": -77.03,
  "image_url": "https://.../uploads/establishments/file.jpg"
}
```
- Response `200`: Establishment entity
- Errors:
  - `400` validation error

`POST /establishments/suggest-images`
- Purpose: list reusable establishment images already stored in DB.
- Request body:
```json
{
  "query": "optional-filter-string"
}
```
- Response `200`:
```json
{
  "data": [
    { "image_url": "https://.../uploads/establishments/file-1.jpg" },
    { "image_url": "https://.../uploads/establishments/file-2.jpg" }
  ]
}
```

`POST /establishments`
- Request body:
```json
{
  "name": "Store",
  "category": "restaurant",
  "image_url": "https://.../uploads/establishments/file.jpg",
  "address": "Av. Larco 345, Miraflores, Lima, Peru",
  "country": "Peru",
  "state_region": "Lima",
  "district": "Miraflores",
  "latitude": -12.123,
  "longitude": -77.03
}
```
- Response `201`:
```json
{
  "id": "uuid",
  "name": "Store",
  "category": "restaurant",
  "image_url": "https://.../uploads/establishments/file.jpg",
  "address": "Av. Larco 345, Miraflores, Lima, Peru",
  "country": "Peru",
  "state_region": "Lima",
  "district": "Miraflores",
  "latitude": -12.123,
  "longitude": -77.03,
  "created_at": "2026-02-09T12:00:00Z"
}
```
- Errors:
  - `400` validation error

`PUT /establishments/:id`
- Request body:
```json
{
  "name": "Store",
  "category": "restaurant",
  "image_url": "https://.../uploads/establishments/file.jpg",
  "address": "Av. Larco 345, Miraflores, Lima, Peru",
  "country": "Peru",
  "state_region": "Lima",
  "district": "Miraflores",
  "latitude": -12.123,
  "longitude": -77.03
}
```
- Response `200`:
```json
{
  "id": "uuid",
  "name": "Store",
  "category": "restaurant",
  "image_url": "https://.../uploads/establishments/file.jpg",
  "address": "Av. Larco 345, Miraflores, Lima, Peru",
  "country": "Peru",
  "state_region": "Lima",
  "district": "Miraflores",
  "latitude": -12.123,
  "longitude": -77.03,
  "created_at": "2026-02-09T12:00:00Z"
}
```
- Errors:
  - `400` validation error
  - `404` establishment not found

`POST /establishments/upload-image`
- Auth: any authenticated user
- Request body:
```json
{
  "file_name": "store-front.jpg",
  "mime_type": "image/jpeg",
  "data_url": "data:image/jpeg;base64,..."
}
```
- Limits:
  - Allowed mime types: `image/jpeg`, `image/png`, `image/webp`
  - Max decoded size: `1,500,000` bytes
- Response `201`:
```json
{
  "image_url": "http://localhost:3000/uploads/establishments/store-front-uuid.jpg"
}
```

### Reviews

`POST /reviews`
- Request body:
```json
{
  "user_id": "uuid",
  "establishment_id": "uuid",
  "title": "Great service and fast delivery",
  "description": "text...",
  "stars": 4,
  "price": 90.5,
  "purchase_url": "https://...",
  "tags": ["tag1", "tag2"],
  "evidence_images": ["https://...","https://..."]
}
```
- Response `201`:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "establishment_id": "uuid",
  "title": "Great service and fast delivery",
  "description": "text...",
  "stars": 4,
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

Validation notes:
- `title` is required and must contain at most 12 words.
- `stars` must be an integer between 0 and 5.
- `purchase_url` is optional; when provided, it must be a valid URL.
- `evidence_images` must contain between 1 and 3 valid URLs.
- Captcha policy: captcha is required only for immediate subsequent review attempts (configurable cooldown window after the latest review). When required, client must send `captcha_token` and `captcha_answer`.

`GET /reviews/captcha-challenge` (authenticated)
- Returns whether captcha is required for the current user.
- Response includes `cooldown_minutes`.
- If required, returns a short-lived arithmetic challenge and `captcha_token`.

`POST /reviews/upload-evidence`
- Request body:
```json
{
  "file_name": "evidence.jpg",
  "mime_type": "image/jpeg",
  "data_url": "data:image/jpeg;base64,..."
}
```
- Limits:
  - Allowed mime types: `image/jpeg`, `image/png`, `image/webp`
  - Max decoded size: `1,500,000` bytes
- Response `201`:
```json
{
  "image_url": "http://localhost:3000/uploads/reviews/evidence-uuid.jpg"
}
```

`GET /reviews/:id`
- Response `200`: Review entity
- Errors:
  - `404` not found

`GET /reviews`
- Query params:
  - `page` (default 1)
  - `page_size` (default 20)
  - `establishment_id` (optional UUID filter)
  - `sort` (optional, allowed: `stars_desc`)
- Response `200`:
```json
{
  "data": [ /* Review entities */ ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 0
  }
}
```

### Leaderboard

`GET /leaderboard`
- Query params:
  - `page` (default 1)
  - `page_size` (default 20)
- Response `200`:
```json
{
  "data": [
    {
      "user_id": "uuid",
      "name": "User",
      "avatar_url": "https://...",
      "total_points": 42
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 0
  }
}
```

### Syscoin

`POST /syscoin/review-hash`
- Purpose: submit a review hash to Syscoin devnet asynchronously.
- Request body:
```json
{
  "review_id": "uuid"
}
```
- Response `202`:
```json
{
  "review_id": "uuid",
  "review_hash": "hash",
  "user_wallet": "0x...",
  "establishment_id_hash": "0x...",
  "tx_hash": "0x...",
  "payload": {
    "review_id": "uuid",
    "user_id": "uuid",
    "establishment_id": "uuid",
    "timestamp": "2026-02-09T12:00:00Z",
    "price": 90.5
  }
}
```
- Errors:
  - `400` validation error
  - `404` review not found

### Admin – Points Configuration

`GET /admin/points-config`
- Response `200`:
```json
{
  "image_points_yes": 1,
  "image_points_no": 0,
  "description_points_gt_200": 2,
  "description_points_lte_200": 1,
  "stars_points_yes": 1,
  "stars_points_no": 0,
  "price_points_lt_100": 1,
  "price_points_gte_100": 2,
  "default_user_avatar_url": "https://.../uploads/config/default-avatar.jpg"
}
```

`PUT /admin/points-config`
- Request body:
```json
{
  "image_points_yes": 1,
  "image_points_no": 0,
  "description_points_gt_200": 2,
  "description_points_lte_200": 1,
  "stars_points_yes": 1,
  "stars_points_no": 0,
  "price_points_lt_100": 1,
  "price_points_gte_100": 2,
  "default_user_avatar_url": "https://.../uploads/config/default-avatar.jpg"
}
```

`POST /admin/points-config/default-avatar`
- Request body:
```json
{
  "file_name": "default-avatar.jpg",
  "mime_type": "image/jpeg",
  "data_url": "data:image/jpeg;base64,..."
}
```
- Limits:
  - Allowed mime types: `image/jpeg`, `image/png`, `image/webp`
  - Max decoded size: `1,500,000` bytes
- Response `201`:
```json
{
  "default_user_avatar_url": "http://localhost:3000/uploads/config/default-avatar-uuid.jpg"
}
```
- Response `200`: same shape as GET
- Errors:
  - `400` validation error

## Idempotency and Duplicates

- `POST /reviews` should support `Idempotency-Key` header. If the same key is reused for the same user, the backend returns the original `201` response.
- `review_hash` is unique and should raise `409` on duplicates.
