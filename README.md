# Taj Chicken Shop

A responsive storefront for Taj Chicken Shop in Umariya Isra, built with React and Vite.

## Run locally

```sh
npm install
npm run dev
```

## Validate

```sh
npm run lint
npm run build
```

## Supabase setup

The app reads live rates from `public.shop_rates` and allows only an approved, signed-in shopkeeper to edit them.

1. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
2. Create and confirm the shopkeeper account in Supabase Auth.
3. Replace `REPLACE_WITH_SHOPKEEPER_EMAIL` in [`supabase/add-shop-admin.sql`](./supabase/add-shop-admin.sql) with the confirmed shopkeeper email, then run it to authorize that account.
4. Configure the project URL and public key in `.env.local` using `.env.example` as a reference, then restart Vite.

The browser uses only the public publishable key. Never put a service-role key in the frontend or `.env.local`. The SQL migration enables row-level security and does not invent or seed shop prices. After setup, the shopkeeper must enter the current rates in the editor. Until live rates are published, the site reports that prices are unavailable instead of presenting design references as current data.
