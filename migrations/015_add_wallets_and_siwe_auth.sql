-- Migration: separate wallets from users and add SIWE nonce/session storage

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON wallets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_address_lower_idx ON wallets((lower(address)));

INSERT INTO wallets (user_id, address, last_login)
SELECT u.id, u.wallet_address, NOW()
FROM users u
WHERE u.wallet_address IS NOT NULL
  AND length(trim(u.wallet_address)) > 0
ON CONFLICT (address) DO NOTHING;

CREATE TABLE IF NOT EXISTS auth_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    uri TEXT NOT NULL,
    chain_id BIGINT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_nonces_wallet_idx ON auth_nonces((lower(wallet_address)));
CREATE INDEX IF NOT EXISTS auth_nonces_expires_idx ON auth_nonces(expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    jti UUID NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx ON auth_sessions(expires_at);
