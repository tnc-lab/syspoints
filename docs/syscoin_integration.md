# Syscoin Integration

## Purpose (Definido en los docs)
- Store an immutable hash of review metadata on-chain.
- Do NOT store full review data on blockchain.
- Backend remains the source of truth.
- Blockchain interaction is asynchronous.

## Hash Content (Definido en los docs)
The JSON used for hashing includes:
- review_id
- user_id
- establishment_id
- timestamp
- price

## Network Configuration

### Extraido del .env

| Variable | Value | Notes |
| --- | --- | --- |
| RPC_URL | https://rpc-pob.dev11.top | EVM JSON-RPC endpoint |
| CHAIN_ID | 57042 | EVM chain id |
| PRIVATE_KEY | present (redacted) | Used to sign transactions |

### Pendiente de definicion

| Item | Status | Notes |
| --- | --- | --- |
| Network name | missing | Not present in `.env` |
| Contract address | missing | No contract specified |
| Contract ABI / method | missing | No ABI or method specified |
| Gas strategy | missing | No policy defined |
| Confirmations required | missing | Not specified |

## Technical Dependencies

### Definido en los docs
- None specified.

### Pendiente de definicion
- EVM library selection: `ethers` or `web3`.
- Provider creation: JsonRpcProvider using `RPC_URL`.
- Signer creation: Wallet with `PRIVATE_KEY` + provider.

## Backend Usage (How vars are used)

### Definido en los docs
- Backend generates the review hash.
- Hash is stored on-chain asynchronously.

### Extraido del .env
- `RPC_URL` is required to connect to the Syscoin EVM network.
- `CHAIN_ID` must match the network to avoid signing on the wrong chain.
- `PRIVATE_KEY` is required to sign the transaction that stores the hash.

### Pendiente de definicion
- Exact on-chain write flow (contract call vs. raw transaction).
- Where/how the async job is triggered (queue, cron, hook).

## Endpoints Dependent on Syscoin

### Definido en los docs
- No public API endpoints are defined for blockchain operations.

### Pendiente de definicion
- If a public endpoint is required, define it explicitly (path, body, response, errors), for example a hash submission or status endpoint.

## Common Integration Errors

### Definido en los docs
- None specified.

### Pendiente de definicion
- RPC down / unreachable (`RPC_URL` not responding).
- Chain ID mismatch (signing for wrong network).
- RPC timeout.
- Invalid or missing `PRIVATE_KEY`.
- Insufficient funds for gas.
