# EB Chemical Platform

This repository groups the central EB Chemical API and standalone CPanel in one deployment workspace. The public EB Chemical storefront remains a separate frontend project and is not included here.

## Repository layout

- `api/` — Express backend and central multi-company API, sourced from `eb-chemical-api` branch `cpanel-company-memberships-foundation`.
- `cpanel/` — React/Vite admin panel, sourced from `eb-chemical-cpanel` branch `cpanel-company-memberships-ui`.
- `docs/` — architecture and deployment guidance for the combined platform.

The CPanel calls the API using `VITE_API_URL`. It must point to the browser-accessible API origin for the target environment.

## API setup

```powershell
cd api
npm ci
Copy-Item .env.example .env
npm start
```

Configure `api/.env` locally or in the deployment platform. At minimum, production requires a strong `JWT_SECRET` plus the appropriate Supabase and CORS settings documented in `api/.env.example` and `api/README.md`.

## CPanel setup

```powershell
cd cpanel
npm ci
Copy-Item .env.example .env
npm run dev
```

For a production build:

```powershell
cd cpanel
npm ci
npm run build
npm run preview
```

The deployable static output is written to `cpanel/dist/`.

## Environment and secret safety

- Never commit `.env` files, service-role keys, JWT secrets, passwords, runtime uploads, or local data-store files.
- The committed `.env.example` files contain placeholders and development examples only.
- Create environment variables locally, in CI, or in the deployment provider's secret manager.
- Do not enable a second public company until the migration, staging, domain verification, and tenant-isolation checks have passed.

See [docs/overview.md](docs/overview.md) and [docs/deployment-plan.md](docs/deployment-plan.md) before deployment.

