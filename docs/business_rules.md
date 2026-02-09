# Business Rules – Syspoints

## Users
- Users can register using:
  - Wallet
  - Email (wallet is auto-generated)
- Each user has:
  - name
  - email
  - avatar

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
  - Images about product or service
  - Description (minimum length enforced)
  - Star rating (1 to 5)
  - Product or service price
  - URL of purchase or consumption
  - Tags / labels
  - Timestamp (automatic)

### Evidence
- User must upload images to validate usage or purchase

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

## Flowchart Diagram

```mermaid
  flowchart TD

    %% USER REGISTRATION
    start([User enters platform]) --> reg{Register method?}

    reg -->|Wallet| wallet[Connect wallet]
    reg -->|Email| email[Register with email<br/>Auto-generate wallet]

    wallet --> profile[Create user profile<br/>name • email • avatar]
    email --> profile

    profile --> dashboard[User dashboard created]

    %% REVIEW CREATION
    dashboard --> create[Create review]
    create --> est{Establishment exists?}

    est -->|No| reject1[Reject review<br/>Only predefined establishments allowed]
    est -->|Yes| evidence{Images uploaded?}

    evidence -->|No| reject2[Reject review<br/>Evidence required]
    evidence -->|Yes| desc{Description ≥ minimum length?}

    desc -->|No| reject3[Reject review<br/>Minimum length enforced]
    desc -->|Yes| rating{Star rating provided?}

    rating -->|No| continue1[Continue]
    rating -->|Yes| continue1

    continue1 --> price{Price informed?}
    price -->|No| reject4[Reject review]
    price -->|Yes| url{URL provided?}

    url -->|No| reject5[Reject review]
    url -->|Yes| tags[Attach tags/labels]

    tags --> timestamp[Timestamp generated automatically]
    timestamp --> immutable[Review saved as immutable<br/>Cannot edit or delete]

    %% POINTS ENGINE
    immutable --> calc[Start points calculation]

    calc --> imgPts{Images uploaded?}
    imgPts -->|Yes| p1[+1 point]
    imgPts -->|No| p0[+0]

    p1 --> descPts{Description >200 chars?}
    p0 --> descPts

    descPts -->|Yes| p2[+2 points]
    descPts -->|No| p3[+1 point]

    p2 --> ratingPts{Star rating provided?}
    p3 --> ratingPts

    ratingPts -->|Yes| p4[+1 point]
    ratingPts -->|No| p5[+0]

    p4 --> pricePts{Price ≥100 PEN?}
    p5 --> pricePts

    pricePts -->|Yes| p6[+2 points]
    pricePts -->|No| p7[+1 point]

    p6 --> total[Sum total points]
    p7 --> total

    total --> update[Update user score<br/>in database]
    update --> finish([Review published + points awarded])

    %% ADMIN SECTION
    subgraph Admin Controls
        admin1[Admin configures point values]
        admin2[Admin adds establishments/products]
        admin3[Admin manages system rules]
    end
```
