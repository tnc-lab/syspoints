# Business Rules – Syspoints

## Users
- Users can register using:
  - Wallet
  - Email (wallet is auto-generated)
- Each user has:
  - name
  - email
  - avatar
  - role (`user` or `admin`)

## Establishments
- Reviews can only be created for establishments persisted in DB
- Examples:
  - stores
  - restaurants
  - services
- Establishments are resolved from OSM location search by `name + address` to avoid duplicates.
- Same establishment name in different places is treated as different records using full address and geo fields.

## Reviews
A review:
- Cannot be edited or deleted
- Must include:
  - Choose or resolve a store/restaurant/service from location search
  - Title (short, standard title)
  - Images about product or service
  - Description (minimum length enforced)
  - Star rating (0 to 5)
  - Product or service price
  - URL of purchase or consumption
  - Tags / labels
  - Timestamp (automatic)

Validation rules
- `description` must be at least 1 character long (minimum length is enforced; exact threshold is 1 until specified).
- `description` must be at most 2000 characters.
- `title` is required and validated by character length (word count is not enforced).
- `title` must be at most 120 characters.
- `stars` must be between 0 and 5.
- `price` must be greater than 0 (PEN).
- `purchase_url` is optional; if provided, it must be a valid `http://` or `https://` URL.
- `tags` must contain at least one value.
- `tags` values must contain between 2 and 30 characters.
- `title`, `description`, and `tags` must not include HTML/script-like content.
- `title`, `description`, and `tags` must not include emojis.
- Evidence images must be between 1 and 3.
- `evidence_images` URLs must use `http://` or `https://`.

### Evidence
- User must upload images to validate usage or purchase
- Each review must include between 1 and 3 evidence images

## Points system
Points are awarded per review:

- Upload images:
  - yes → 1 point
  - no → 0 points

- Review description:
  - > 200 characters → 2 points
  - ≤ 200 characters → 1 point

- Star rating provided:
  - yes → 1 point
  - no → 0 points

- Product/service price:
  - < 100 PEN → 1 point
  - ≥ 100 PEN → 2 points

## Administration
- Point values must be configurable by an administrator
- Establishments can be added by admin panel or resolved automatically from location search flow
- Each user have a dashboard

Admin rules
- Only `admin` users can create/update establishments manually via admin endpoints.
- Only `admin` users can update points configuration.
- Only `admin` users can list all users.
- Reviews list is public (frontend homepage).
- Any authenticated user can upload an establishment image via `POST /establishments/upload-image`.

Authentication
- Login is wallet-only via signature.

## States and Transitions

User
- States: `active`
- Invalid transitions: none specified

Establishment
- States: `active`
- Invalid transitions: none specified

Review
- States: `created`
- Invalid transitions: `update`, `delete`
