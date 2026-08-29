# BoldShare Monetization & Auth Design

## Context

BoldShare is being converted from a fully anonymous, free tool into a micro-SaaS. Ads alone can't fund a file-sharing product at a 1GB file size (bandwidth/storage cost scales with usage; ad revenue from a low-page-count utility flow doesn't). The agreed model: free tier stays ad-supported with a small storage cap, a paid tier removes the cap (mostly) and the ads, funded by a $9/month subscription. This requires the app's first real concept of a "user" — today every share (text or file) is a fully anonymous nanoid link with no owner, no accounts, no payments.

This spec covers everything needed to add accounts, per-user storage quotas, a usage dashboard, and Stripe billing. It intentionally leaves text-sharing untouched.

## Goals

- Users can log in (email/password, magic link, or Google) to upload files.
- Free accounts get a 50MB total storage cap (sum of their currently-active, non-expired files); premium accounts get 1GB, for $9/month via Stripe.
- Users can see how much of their quota they've used and delete files manually to free it up early.
- Ads show only for free-plan users.
- Uploads that would exceed the quota are rejected *before* any bytes are uploaded, not after.
- Canceling/lapsing a subscription never force-deletes a user's files — they keep working until they naturally expire; only new uploads are blocked while over the free limit.

## Non-goals (explicitly out of scope for this pass)

- Any change to text-sharing (`/text-sharing`, `/api/share`, `/p/[id]`) — stays fully anonymous, unlimited, untouched.
- Any change to who can *view/download* a shared file — `/f/[id]` and `/api/download/[id]` stay public; only *uploading* requires login.
- Account deletion / data export flows.
- Team/multi-user accounts, API keys, admin tooling.
- Migrating existing `files` rows (pre-launch project, no real production data to migrate).

## Data Model

`src/schema.ts` changes:

- **`files` table**: add `userId: uuid('user_id').notNull()`. Every file now has an owner. Index on `user_id` (and keep the existing usefulness of `expires_at` for the quota query below).
- **New `subscriptions` table**: one row per user, keyed by their Supabase auth user id (uuid, primary key — not a Drizzle FK, since `auth.users` lives in Supabase's managed `auth` schema, not ours).
  ```ts
  export const subscriptions = pgTable('subscriptions', {
    userId: uuid('user_id').primaryKey(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status').notNull().default('free'), // 'free' | 'active' | 'past_due' | 'canceled'
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  });
  ```
- **No `snippets` schema change.**
- **No denormalized "storage used" counter.** Usage is always computed on the fly:
  `SELECT COALESCE(SUM(size), 0) FROM files WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`
  This can never drift from reality (a maintained counter could, if a decrement is ever missed) and is fast at this scale with the `user_id` index.
- Plan is derived, not stored redundantly: `isPremium = subscription?.status === 'active'`. Limits live as two constants in a new `src/lib/plans.ts`:
  ```ts
  export const FREE_LIMIT_BYTES = 50 * 1024 * 1024;
  export const PREMIUM_LIMIT_BYTES = 1024 * 1024 * 1024;
  ```

## Auth

- Supabase Auth (already the project's backend) handles identity. Email/password, magic link, and Google OAuth all enabled in the Supabase dashboard (manual, one-time config — not code).
- Add `@supabase/ssr` dependency for cookie-based sessions readable during Astro SSR (distinct from the existing `src/lib/supabase.ts`, which stays a service-role admin client used only by trusted server code for storage operations — never exposed to a user session).
- New `src/lib/supabase-server.ts`: creates a request-scoped Supabase client using the anon key + cookies, for reading/writing the session.
- New `src/middleware.ts`: on every request, reads the session via `supabase-server.ts` and sets `Astro.locals.user` (or `null`). Single shared place to check auth — pages and API routes both read `Astro.locals.user` instead of re-deriving it.
- New pages: `src/pages/login.astro` (email/password form + magic-link form + "Sign in with Google" button), `src/pages/auth/callback.astro` (completes OAuth/magic-link sign-in, redirected to by Supabase).

### Route protection

| Route | Auth required? |
|---|---|
| `/`, `/text-sharing`, `/p/[id]`, `/api/share` | No (unchanged) |
| `/f/[id]`, `/api/download/[id]` | No (unchanged — viewing/downloading needs no login) |
| `/file-sharing`, `/dashboard` | Yes — redirect to `/login` if `Astro.locals.user` is null |
| `/api/get-upload-url`, `/api/finalize-upload`, `/api/files/[id]` (delete), `/api/create-checkout-session`, `/api/billing-portal` | Yes — 401 JSON if `Astro.locals.user` is null |
| `/api/webhooks/stripe` | No user session (authenticated instead by verifying Stripe's signature header) |

## Upload flow & quota enforcement

Quota is checked **before** any bytes move, not after — the alternative (let the upload happen, reject at finalize) wastes real storage/bandwidth on rejected uploads and makes the user wait through a full upload just to be told no.

1. Browser picks a file — `file.size` and `file.name` come from the browser's own `File` object (already read today in `FileUploader.tsx` for the client-side 50MB check), never typed in by the user.
2. `POST /api/get-upload-url` now requires the body to include `fileSize` alongside `fileName`, and requires `Astro.locals.user`. It:
   - Computes the user's current usage (query above) and their limit (based on `subscriptions.status`).
   - If `usage + fileSize > limit`, returns `403` with `{ error: 'quota_exceeded', usage, limit }` — no signed URL issued.
   - Otherwise proceeds exactly as today (creates the signed Supabase upload URL).
3. Browser uploads directly to Supabase (unchanged).
4. `POST /api/finalize-upload` requires `Astro.locals.user`; sets `userId` from the session server-side (never trusts a client-supplied user id) and writes the `files` row as today.
5. `FileUploader.tsx` handles the `403 quota_exceeded` response with an inline message: *"You've used {usage}MB of your {limit}MB. Delete some files, or upgrade to Premium for 1GB."* with a link to `/dashboard` and an upgrade button.

## Dashboard (`/dashboard`, new page)

Server-rendered Astro page (same pattern as `/p/[id]`, `/f/[id]` — query the DB directly in frontmatter, no separate API needed for reads):
- Usage meter: progress bar + "{usedMB} / {limitMB} used", always visible regardless of how close to the limit.
- List of the user's currently-active (non-expired) files: name, size, expires-in, **Delete** button per row.
- Delete (`DELETE /api/files/[id]`, new endpoint): verifies `Astro.locals.user` owns the file, removes it from Supabase Storage, deletes the DB row. Frees quota immediately, not at expiry.
- Free-plan users: "Upgrade to Premium — $9/mo" card. Premium users: renewal date + "Manage Billing" link (see below).

## Ads

Ads render only when the current viewer is on the free plan — on `/file-sharing` and `/dashboard`. Fully hidden for premium (`subscriptions.status === 'active'`). No schema impact; purely a conditional render based on the plan already being computed for the quota check.

## Billing (Stripe)

- `POST /api/create-checkout-session`: creates a Stripe Checkout Session for the $9/month price (price ID from env config), `customer_email` prefilled from the session, success/cancel URLs pointing back to `/dashboard`. Returns the session URL; client redirects the browser to it.
- `POST /api/billing-portal`: creates a Stripe Billing Portal session for the user's existing `stripeCustomerId`, so they can update card details or cancel — no custom cancellation UI needed.
- `POST /api/webhooks/stripe` (new, unauthenticated route but verifies the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`):
  - `checkout.session.completed` → upsert `subscriptions` row: store `stripeCustomerId`, `stripeSubscriptionId`, set `status = 'active'`, `currentPeriodEnd`.
  - `customer.subscription.updated` → sync `status` and `currentPeriodEnd` (handles renewals, `past_due`, etc).
  - `customer.subscription.deleted` → set `status = 'canceled'`. This is the only place cancellation is handled — no forced file deletion. The user reverts to the free 50MB limit; existing files over that limit keep working until they expire naturally, and new uploads are blocked until they're back under 50MB (same `403 quota_exceeded` path as any free user).
- New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID`, plus the existing `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` already used by `src/lib/supabase.ts`.
- New dependencies: `stripe` (Node SDK), `@supabase/ssr`.

## Error handling summary

- Quota exceeded at upload time → `403 quota_exceeded` with actionable copy (delete files / upgrade), never a bare "upload failed."
- Not logged in, hitting a protected page → redirect to `/login`; hitting a protected API → `401`.
- Stripe webhook with an invalid/missing signature → `400`, event ignored (prevents forged plan upgrades).
- Deleting a file you don't own → `403` (ownership check in `/api/files/[id]`).

## Testing / Verification Plan

- Stripe test mode + the Stripe CLI (`stripe listen --forward-to localhost:.../api/webhooks/stripe`) to simulate the full checkout → webhook → cancel cycle locally with fake cards before anything touches real money.
- Manual pass through each auth method (password, magic link, Google) end-to-end.
- Upload up to the free limit, confirm the next upload is rejected with the correct message and no file lands in Supabase Storage.
- Delete a file from the dashboard, confirm usage drops immediately and another upload up to the freed amount succeeds.
- Upgrade in test mode, confirm the 1GB limit applies and ads disappear; cancel, confirm reversion to free behavior (grace mode) without any file being deleted.
- Confirm `/p/[id]`, `/text-sharing`, `/f/[id]`, `/api/download/[id]` all still work with zero login prompts.
