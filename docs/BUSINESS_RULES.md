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
- Reviews can only be created for predefined establishments
- Examples:
  - stores
  - restaurants
  - services

## Reviews
A review:
- Cannot be edited or deleted
- Must include:
  - Choose listed store, restaurant or service
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
- `title` is required and must contain at most 12 words.
- `stars` must be between 0 and 5.
- `price` must be greater than 0 (PEN).
- `purchase_url` must be a valid URL.
- `tags` must contain at least one value.
- Evidence images must be between 1 and 3.

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
- Products must be added by an administrator
- Each user have a dashboard

Admin rules
- Only `admin` users can create establishments.
- Only `admin` users can update points configuration.
- Only `admin` users can list all users.
- Reviews list is public (frontend homepage).

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

## Flowchart Diagram

```mermaid
  flowchart TD

    %% AUTH
    start([User enters platform]) --> login{Login via wallet signature}

    login -->|Valid signature| authOK[Authenticated<br/>JWT issued]
    login -->|Invalid| authFail[Reject login]

    authOK --> role{User role?}

    role -->|admin| adminDash[Admin dashboard]
    role -->|user| userDash[User dashboard]

    %% ADMIN ACTIONS
    adminDash --> adminActions{Admin action}

    adminActions -->|Create establishment| createEst[Add establishment<br/>set category]
    adminActions -->|Update points config| configPts[Configure point rules]
    adminActions -->|List users| listUsers[List all users]

    createEst --> estActive[Establishment active]
    configPts --> adminDash
    listUsers --> adminDash

    %% REVIEW CREATION
    userDash --> createReview[Create review]

    createReview --> estCheck{Establishment exists?}
    estCheck -->|No| rejectEst[Reject<br/>Only predefined establishments allowed]
    estCheck -->|Yes| titleCheck{Title ≤ 12 words?}

    titleCheck -->|No| rejectTitle[Reject title]
    titleCheck -->|Yes| descCheck{Description ≥ 1 char?}

    descCheck -->|No| rejectDesc[Reject description]
    descCheck -->|Yes| starCheck{Stars between 0–5?}

    starCheck -->|No| rejectStars[Reject stars]
    starCheck -->|Yes| priceCheck{Price > 0?}

    priceCheck -->|No| rejectPrice[Reject price]
    priceCheck -->|Yes| urlCheck{Valid purchase URL?}

    urlCheck -->|No| rejectURL[Reject URL]
    urlCheck -->|Yes| tagCheck{At least 1 tag?}

    tagCheck -->|No| rejectTags[Reject tags]
    tagCheck -->|Yes| evidenceCheck{1–3 evidence images?}

    evidenceCheck -->|No| rejectEvidence[Reject review<br/>Evidence required]
    evidenceCheck -->|Yes| timestamp[Timestamp generated]

    timestamp --> immutable[Save review<br/>State = created<br/>Immutable]

    %% POINTS
    immutable --> calc[Start points calculation]

    calc --> imgPts{Images uploaded?}
    imgPts -->|Yes| p1[+1]
    imgPts -->|No| p0[+0]

    p1 --> descPts
    p0 --> descPts

    descPts{Description >200 chars?}
    descPts -->|Yes| p2[+2]
    descPts -->|No| p3[+1]

    p2 --> starPts
    p3 --> starPts

    starPts{Star rating provided?}
    starPts -->|Yes| p4[+1]
    starPts -->|No| p5[+0]

    p4 --> pricePts
    p5 --> pricePts

    pricePts{Price ≥100 PEN?}
    pricePts -->|Yes| p6[+2]
    pricePts -->|No| p7[+1]

    p6 --> total
    p7 --> total

    total[Sum total points] --> savePts[Store points_awarded]
    savePts --> publish[Review published<br/>Visible publicly]

    %% STATES
    subgraph States
        s1[User: active]
        s2[Establishment: active]
        s3[Review: created]
        s4[Invalid transitions:<br/>update ❌ delete ❌]
    end

    immutable -.state.-> s3
    s3 -.rules.-> s4
```