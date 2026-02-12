# Deploy on Vercel (Backend)

## 1. Prerequisites
- Vercel account
- Neon PostgreSQL database
- Contract deployed on Syscoin devnet

## 2. Environment Variables (Vercel)
Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL` (Neon connection string)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `1h`)
- `RPC_URL`
- `CHAIN_ID`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `BASE_URL` = `https://syspoints-dev.vercel.app`
- `CORS_ORIGIN` = `https://syspoints.vercel.app,http://localhost:5173`
- `PGPOOL_MAX` = `1`

### Persistent image storage (recommended on Vercel)
To avoid losing images between serverless instances, configure Cloudinary:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (optional, default: `syspoints`)

## 3. Vercel Config
The repository includes `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    { "src": "app.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "app.js" }
  ]
}
```

## 4. Deploy
From the repo root:

```bash
vercel --prod
```

## 5. Verify
- API base: `https://syspoints-dev.vercel.app`
- Swagger UI: `https://syspoints-dev.vercel.app/docs`

## 6. Post-deploy checks
- Test `/auth/nonce` and `/auth/token`
- Test a protected endpoint with Bearer token
- Test `/reviews` pagination
- Test `/syscoin/review-hash`
