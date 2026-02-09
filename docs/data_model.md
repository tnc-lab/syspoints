# Data Model – PostgreSQL

## User
- id
- wallet_address
- email
- name
- avatar_url
- created_at

## Establishment
- id
- name
- category
- created_at

## Review
- id
- user_id
- establishment_id
- description
- stars
- price
- purchase_url
- tags
- created_at
- points_awarded
- review_hash

## Entity-Relationship (ER) Diagrams

```mermaid
    erDiagram

    USER {
        uuid id
        string wallet_address
        string email
        string name
        string avatar_url
        timestamp created_at
    }

    ESTABLISHMENT {
        uuid id
        string name
        string category
        timestamp created_at
    }

    REVIEW {
        uuid id
        uuid user_id
        uuid establishment_id
        text description
        int stars
        decimal price
        string purchase_url
        string tags
        timestamp created_at
        int points_awarded
        string review_hash
    }

    USER ||--o{ REVIEW : creates
    ESTABLISHMENT ||--o{ REVIEW : receives
```