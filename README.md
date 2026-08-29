# Boosie Network

An owned digital entertainment platform: culture journalism, music, film, live streaming,
commerce, community and charitable campaigns in one application.

Built with Next.js 15 (App Router), TypeScript, PostgreSQL via Prisma, and Tailwind.

---

## Status

The codebase is complete but **has not been compiled, linted, type-checked, or run**. It was
authored in an environment without network access, so `npm install` was never possible and
therefore neither were `tsc`, `eslint`, `vitest`, or `next build`.

**Your first task is to run the verification steps below and fix what they surface.** Expect a
residue of type errors — mostly around Prisma's generated types, which cannot be known until
`prisma generate` has actually run against the schema.

---

## Requirements

- Node.js 20.11 or newer
- PostgreSQL 14 or newer
- A Stripe account (optional for local development; required for checkout)
- An S3-compatible bucket (optional locally; a local-disk fallback is used when unset)

---

## Setup

```bash
npm install
cp .env.example .env        # then edit .env — see the table below
npm run db:migrate          # creates the schema and generates the client
npm run db:seed             # demo content + your development OWNER account
npm run dev                 # http://localhost:3000
```

The seed prints the development owner's password **once**. Save it. If you prefer to choose it,
set `SEED_OWNER_PASSWORD` before seeding. Re-running the seed never overwrites an existing
owner's password.

### Verify before trusting it

```bash
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # vitest
npm run build        # production build
```

---

## Environment variables

Required:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for session security. Generate with `openssl rand -base64 32` |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Absolute base URL, e.g. `http://localhost:3000` |

Payments — checkout, memberships and donations are disabled without these:

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-side Stripe key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe key |
| `STRIPE_WEBHOOK_SECRET` | **Required.** Without it, orders never move past PENDING and entitlements are never granted |
| `STRIPE_CURRENCY` | Defaults to `usd` |

Storage — falls back to `./public/uploads` when unset, which is not durable on most hosts:

`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_FORCE_PATH_STYLE`, `S3_PUBLIC_BASE_URL`

Email — logs to console when unset:

`EMAIL_PROVIDER` (`console` | `resend`), `EMAIL_FROM`, `RESEND_API_KEY`

Other: `LIVE_PROVIDER`, `FEATURE_LIVE_ENABLED`, `RADIO_DEFAULT_STREAM_URL`,
`SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_OWNER_NAME`.

The admin Settings page shows which integrations resolved at runtime, without revealing secrets.

---

## Stripe webhooks

Orders are only marked paid by webhook — never by the browser returning from checkout, and never
by hand in the admin. Locally:

```bash
npm run stripe:listen   # stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET`.

Handled events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`,
`invoice.payment_failed`, `charge.refunded`. Every event id is recorded in `WebhookEvent`, so
Stripe's retries are idempotent.

---

## Architecture notes

**Authentication.** Database-backed opaque session tokens. A 32-byte random token goes into an
httpOnly `bn_session` cookie; only its SHA-256 hash is stored. Passwords use bcrypt at cost 12.
Changing a password destroys every session. Login is rate limited per-email *and* per-IP, with
account lockout after repeated failures.

**Authorization.** Seven roles (`USER`, `ARTIST`, `ARTIST_PRO`, `EDITOR`, `MODERATOR`, `ADMIN`,
`OWNER`) mapped to explicit permissions in `src/lib/rbac.ts`. Every admin page and every mutating
action re-checks server-side. `middleware.ts` only does a cheap signed-out redirect — it cannot
reach the database and is deliberately not the gate. An `ADMIN` cannot mint another `ADMIN` or an
`OWNER`, and the last `OWNER` cannot be demoted.

**Money.** Every amount is an integer number of cents. Prices are always resolved from the
database in `resolvePurchasable` — the client may only say *what* it wants to buy, never what it
costs. Carts are re-priced at checkout. There is no virtual currency, wallet, token or credit
anywhere in the system, by design.

**Inventory** is decremented only when a payment succeeds, never on add-to-cart, so items sitting
in abandoned carts cannot cause overselling.

**Entitlements.** Buying an album grants the album *and* every track on it. Ownership is
permanent and independent of membership: cancelling a subscription never removes something bought
outright. `evaluateAccess` is the single decision point, used by pages *and* by the media
endpoints — hiding a play button is not access control.

**Media.** Premium audio and video are never rendered into HTML. The player requests
`/api/media/song/[id]` or `/api/media/video/[id]`, access is decided server-side, and only then is
a short-lived signed URL issued.

**Rich text** from article and campaign editors is sanitized on save, before storage.

**Plans** are configuration, not code. Prices, Stripe price IDs and every capability flag live on
the `Plan` row and are editable in the admin.

---

## Project layout

```
prisma/          schema.prisma, seed.ts
src/app/         routes — (public), (auth), (admin), actions/, api/
src/components/  UI, organised by domain
src/lib/         framework-free helpers (rbac, money, utils, nav, env)
src/server/      server-only code
  auth/          sessions, guards, password hashing
  services/      payments, storage, email, cart, orders, entitlements, search…
tests/           vitest
```

`src/server/**` is server-only and must never be imported into a client component. The payment
provider is behind the `PaymentProvider` interface in `src/server/services/payments/types.ts`, so
Stripe can be swapped without touching commerce logic.

---

## Before you launch

1. Run all four verification commands above and fix what they report.
2. **Replace the legal pages.** `/legal/terms`, `/legal/privacy` and the seeded creator agreement
   are clearly-marked placeholder drafts. They have not been reviewed by a lawyer.
3. Configure S3 — the local upload fallback is not durable.
4. Configure `STRIPE_WEBHOOK_SECRET`, or nothing anyone buys will ever be delivered.
5. Delete or replace the seeded demo content, which is deliberately fictional.
6. Rotate `AUTH_SECRET` and the seeded owner password.
