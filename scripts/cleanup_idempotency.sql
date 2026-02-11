-- Cleanup idempotency keys older than 7 days
DELETE FROM idempotency_keys
WHERE created_at < NOW() - INTERVAL '7 days';
