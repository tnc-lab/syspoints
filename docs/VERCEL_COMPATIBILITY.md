# Vercel Compatibility Notes

## Runtime model
- Vercel runs Node.js in a serverless environment.
- The app should export the Express instance from `app.js`.

## Current status
- `app.js` exports the Express app (compatible with `@vercel/node`).
- `server.js` is used for local development only.
- Database connection uses `pg` Pool and reads `DATABASE_URL`.

## Considerations
- Long-lived connections: `pg` Pool is ok for serverless, but you may need
  a low max connection setting if you see connection limits.
- Rate limits: consider adding throttling for auth endpoints.
- Cold starts: keep startup work minimal.

## Suggested adjustments (optional)
- Add `PGPOOL_MAX=1` and read it in db config if Neon hits connection limits.
- Add health endpoint `/health` for uptime checks.
