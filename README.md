# Emaldo® Newsletter Archive

Secure internal archive of Klaviyo campaigns. Next.js (App Router) + Prisma + Vercel-ready.

## Quick start

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Create `.env` from `.env.example` and fill values.

## Deploy on Vercel

- Add env vars in the Vercel dashboard (see `.env.example`)
- Build command: `npm run vercel-build` (ensures migrations are applied)
- Optional cron: POST `/api/admin/klaviyo/sync`
