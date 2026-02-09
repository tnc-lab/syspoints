# Blockchain Integration

## Purpose
- Store an immutable hash of review metadata on-chain
- Do NOT store full review data on blockchain

## Hash content
The JSON used for hashing includes:
- review_id
- user_id
- establishment_id
- timestamp
- price

## Notes
- Hash is generated backend-side
- Blockchain interaction is asynchronous
- Backend remains the source of truth

## Sequence Diagram

```mermaid
    sequenceDiagram
    autonumber

    participant User
    participant Backend
    participant Database
    participant HashService
    participant Queue
    participant Syscoin

    User->>Backend: Submit review
    Backend->>Database: Store review data

    Backend->>HashService: Build metadata JSON
    HashService->>HashService: Generate review hash
    HashService-->>Backend: Return hash

    Backend->>Database: Save review_hash

    Backend->>Queue: Send hash for blockchain anchoring (async)

    Queue->>Syscoin: Write hash to blockchain
    Syscoin-->>Queue: Transaction confirmed

    Queue->>Backend: Return tx_hash + status
    Backend->>Database: Store blockchain tx reference

    Note right of Syscoin: Only hash stored on-chain\nFull review remains off-chain

    Note right of Backend: Backend remains\nsource of truth
```