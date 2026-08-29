# Auth, Quota Enforcement & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login (email/password, magic link, Google) gated only on file uploads, a per-user storage quota (50MB — everyone starts on this plan; premium/$9/mo comes in a follow-up plan), a "My Files" dashboard with a usage meter and delete, and free-tier-only ad slots.

**Architecture:** Supabase Auth (via `@supabase/ssr`) provides identity; an Astro middleware reads the session on every request into `Astro.locals.user`. A new `subscriptions` table records plan status per user (everyone defaults to `'free'` until the next plan adds Stripe); usage is always computed on the fly (`SUM(files.size)` over that user's non-expired files) rather than a maintained counter. Quota is checked server-side before a signed upload URL is ever issued.

**Tech Stack:** Astro 6 (SSR, `@astrojs/node`), React islands, Drizzle ORM / Postgres, Supabase (Auth + Storage), Vitest (new — for the pure quota-math unit tests).

**Spec:** `docs/superpowers/specs/2026-08-29-monetization-auth-design.md`

## Global Constraints

- Text sharing (`/text-sharing`, `/api/share`, `/p/[id]`) and viewing/downloading a shared file (`/f/[id]`, `/api/download/[id]`) get **zero** changes — no auth, ever, on those paths.
- Usage is **always** computed live via `SUM(size) WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())` — never a denormalized counter (spec: "Data Model").
- Quota is checked **before** any upload starts (at `/api/get-upload-url`), never after (spec: "Upload flow & quota enforcement").
- No premium tier or Stripe in this plan — `subscriptions.status` will only ever be `'free'` here; `getLimitBytes` and the schema already support `'active'`/`'past_due'`/`'canceled'` so the next plan (billing) only adds writers to that column, not schema changes.
- **Testing approach for this plan:** pure logic (`src/lib/plans.ts`) gets real Vitest unit tests, written and run TDD-style. Astro pages/API routes that require a live Postgres + Supabase connection are verified with manual `npm run build` + `curl` passes (matching the verification style already used elsewhere in this repo) — this project has no test-database infrastructure, and standing one up is out of scope for this plan.
- This dev environment has no `DATABASE_URL`/Supabase credentials configured (confirmed in an earlier session) — any step that needs a live DB/Supabase call will be written and its command given, but may need to be re-run by whoever has real credentials to see the live result. Say so plainly in that step rather than silently skipping it.

---

### Task 1: Add dependencies and test tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `npm run test` script (runs Vitest once, non-watch).

- [ ] **Step 1: Install runtime and dev dependencies**

Run: `npm install @supabase/ssr`
Run: `npm install -D vitest`

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add the test script**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verify the script runs (no tests yet, should report 0 tests, exit 0)**

Run: `npm run test`
Expected: `No test files found` — non-zero exit is fine at this point, just confirm Vitest itself launches without a config error.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest and @supabase/ssr"
```

---

### Task 2: Schema changes — `files.userId` and `subscriptions` table

**Files:**
- Modify: `src/schema.ts`

**Interfaces:**
- Produces: `files.userId: string` (uuid, not null), `subscriptions` table with columns `userId` (uuid, primary key), `stripeCustomerId`, `stripeSubscriptionId`, `status` (text, default `'free'`), `currentPeriodEnd`, `createdAt`, `updatedAt`.

- [ ] **Step 1: Edit `src/schema.ts`**

```ts
import { pgTable, text, timestamp, integer, uuid } from 'drizzle-orm/pg-core';

export const snippets = pgTable('snippets', {
  id: text('id').primaryKey(), // nanoid short link
  content: text('content').notNull(), // HTML content from Tiptap
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // null means no expiry
});

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});

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

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new SQL file under `drizzle/` adding the `user_id` column to `files` and creating `subscriptions`.

- [ ] **Step 3: Apply the migration (requires a real `DATABASE_URL`)**

Run: `npx drizzle-kit migrate`
Expected: applies cleanly against a real Postgres instance. If `DATABASE_URL` isn't configured in your environment, this step needs to be re-run wherever real credentials are available before the app is used — note that explicitly rather than treating this task as done.

- [ ] **Step 4: Commit**

```bash
git add src/schema.ts drizzle/
git commit -m "feat: add files.user_id and subscriptions table"
```

---

### Task 3: Pure quota logic — `src/lib/plans.ts` (TDD)

**Files:**
- Create: `src/lib/plans.ts`
- Test: `src/lib/plans.test.ts`

**Interfaces:**
- Produces: `FREE_LIMIT_BYTES: number`, `PREMIUM_LIMIT_BYTES: number`, `type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'canceled'`, `getLimitBytes(status: SubscriptionStatus): number`, `hasQuota(usageBytes: number, incomingBytes: number, status: SubscriptionStatus): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/plans.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getLimitBytes, hasQuota, FREE_LIMIT_BYTES, PREMIUM_LIMIT_BYTES } from './plans';

describe('getLimitBytes', () => {
  it('returns the free limit for free status', () => {
    expect(getLimitBytes('free')).toBe(FREE_LIMIT_BYTES);
  });

  it('returns the premium limit for active status', () => {
    expect(getLimitBytes('active')).toBe(PREMIUM_LIMIT_BYTES);
  });

  it('returns the free limit for past_due or canceled status', () => {
    expect(getLimitBytes('past_due')).toBe(FREE_LIMIT_BYTES);
    expect(getLimitBytes('canceled')).toBe(FREE_LIMIT_BYTES);
  });
});

describe('hasQuota', () => {
  it('allows an upload that fits within the limit', () => {
    expect(hasQuota(10 * 1024 * 1024, 20 * 1024 * 1024, 'free')).toBe(true);
  });

  it('rejects an upload that would exceed the limit', () => {
    expect(hasQuota(45 * 1024 * 1024, 10 * 1024 * 1024, 'free')).toBe(false);
  });

  it('allows an upload that exactly fills the remaining quota', () => {
    expect(hasQuota(0, FREE_LIMIT_BYTES, 'free')).toBe(true);
  });

  it('uses the premium limit for an active subscription', () => {
    expect(hasQuota(900 * 1024 * 1024, 100 * 1024 * 1024, 'active')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './plans'` (file doesn't exist yet).

- [ ] **Step 3: Implement `src/lib/plans.ts`**

```ts
export const FREE_LIMIT_BYTES = 50 * 1024 * 1024;
export const PREMIUM_LIMIT_BYTES = 1024 * 1024 * 1024;

export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'canceled';

export function getLimitBytes(status: SubscriptionStatus): number {
  return status === 'active' ? PREMIUM_LIMIT_BYTES : FREE_LIMIT_BYTES;
}

export function hasQuota(usageBytes: number, incomingBytes: number, status: SubscriptionStatus): boolean {
  return usageBytes + incomingBytes <= getLimitBytes(status);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans.ts src/lib/plans.test.ts
git commit -m "feat: add pure quota-limit logic"
```

---

### Task 4: DB-backed usage/status queries — `src/lib/usage.ts`

**Files:**
- Create: `src/lib/usage.ts`

**Interfaces:**
- Consumes: `db` from `src/lib/db.ts`, `files`/`subscriptions` from `src/schema.ts`, `SubscriptionStatus` from `src/lib/plans.ts`.
- Produces: `getUsageBytes(userId: string): Promise<number>`, `getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>`.

- [ ] **Step 1: Implement `src/lib/usage.ts`**

```ts
import { and, eq, gt, isNull, or, sum } from 'drizzle-orm';
import { db } from './db';
import { files, subscriptions } from '../schema';
import type { SubscriptionStatus } from './plans';

export async function getUsageBytes(userId: string): Promise<number> {
  const [result] = await db
    .select({ total: sum(files.size) })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        or(isNull(files.expiresAt), gt(files.expiresAt, new Date()))
      )
    );

  return Number(result?.total ?? 0);
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  return (row?.status as SubscriptionStatus | undefined) ?? 'free';
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check`
Expected: no new type errors from this file. (This module isn't independently testable without a live Postgres connection — its correctness is exercised end-to-end in Task 9's manual verification.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/usage.ts
git commit -m "feat: add per-user usage and subscription status queries"
```

---

### Task 5: `Astro.locals.user` typing

**Files:**
- Create: `src/env.d.ts`

**Interfaces:**
- Produces: `App.Locals.user: import('@supabase/supabase-js').User | null` — every later task reads `Astro.locals.user` (in `.astro` frontmatter) or `locals.user` (in API routes) with this type.

- [ ] **Step 1: Create `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User | null;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check`
Expected: no errors (the middleware that populates `locals.user` is added next task; until then this is just an ambient type declaration).

- [ ] **Step 3: Commit**

```bash
git add src/env.d.ts
git commit -m "feat: type Astro.locals.user"
```

---

### Task 6: Session middleware — `src/lib/supabase-server.ts` + `src/middleware.ts`

**Files:**
- Create: `src/lib/supabase-server.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `App.Locals` from Task 5.
- Produces: `createSupabaseServerClient(request: Request, cookies: AstroCookies)` — returns a Supabase client scoped to the current request's session, used by every server-side auth check in later tasks (login callback, logout, protected pages/routes). Sets `Astro.locals.user` on every request.

- [ ] **Step 1: Implement `src/lib/supabase-server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '';

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, ...rest] = pair.split('=');
      return { name, value: rest.join('=') };
    });
}

export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie'));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
```

- [ ] **Step 2: Implement `src/middleware.ts`**

```ts
import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient(context.request, context.cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  context.locals.user = user;

  return next();
});
```

- [ ] **Step 3: Verify the app still boots with no logged-in user**

Run: `npm run build`
Expected: builds successfully (middleware runs on every request but with no session cookie, `user` will just be `null` everywhere — no existing page reads `Astro.locals.user` yet, so behavior is unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase-server.ts src/middleware.ts
git commit -m "feat: add Supabase session middleware"
```

---

### Task 7: Login page — browser client + `LoginForm.tsx` + `/login`

**Files:**
- Create: `src/lib/supabase-browser.ts`
- Create: `src/components/LoginForm.tsx`
- Create: `src/pages/login.astro`

**Interfaces:**
- Consumes: nothing from earlier tasks (browser-side auth calls go directly to Supabase, not through `locals`).
- Produces: `createSupabaseBrowserClient()` — reused by `LogoutButton.tsx` (Task 8).

- [ ] **Step 1: Implement `src/lib/supabase-browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 2: Implement `src/components/LoginForm.tsx`**

```tsx
import React, { useState } from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';

const supabase = createSupabaseBrowserClient();

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = '/file-sharing';
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage('Check your email to confirm your account.');
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage('Check your email for a login link.');
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  };

  return (
    <div className="max-w-md mx-auto p-8 space-y-6 bg-white neo-brutal">
      <div className="flex gap-4 font-black uppercase text-sm">
        <button onClick={() => setMode('password')} className={mode === 'password' ? 'underline' : 'opacity-50'}>
          Password
        </button>
        <button onClick={() => setMode('magic-link')} className={mode === 'magic-link' ? 'underline' : 'opacity-50'}>
          Magic Link
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-2 border-black p-3 font-bold"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-black p-3 font-bold"
          />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-black text-white px-6 py-3 neo-brutal font-black uppercase flex-1">
              Log In
            </button>
            <button type="button" onClick={handleSignUp} disabled={loading} className="bg-[#00F0FF] px-6 py-3 neo-brutal font-black uppercase flex-1">
              Sign Up
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-2 border-black p-3 font-bold"
          />
          <button type="submit" disabled={loading} className="w-full bg-black text-white px-6 py-3 neo-brutal font-black uppercase">
            Send Magic Link
          </button>
        </form>
      )}

      <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-black px-6 py-3 neo-brutal font-black uppercase">
        Sign in with Google
      </button>

      {message && <p className="font-bold text-green-700">{message}</p>}
      {error && <p className="font-bold text-red-500">{error}</p>}
    </div>
  );
};

export default LoginForm;
```

- [ ] **Step 3: Implement `src/pages/login.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import LoginForm from '../components/LoginForm';

if (Astro.locals.user) {
  return Astro.redirect('/file-sharing');
}
---

<Layout title="Log In — BoldShare" description="Log in to BoldShare to upload and share files." noindex={true}>
  <main class="py-16">
    <LoginForm client:load />
  </main>
</Layout>
```

- [ ] **Step 4: Verify the build succeeds and the page renders**

Run: `npm run build`
Expected: no build errors.

Run: `npm run dev` (in one terminal), then in another: `curl -s localhost:4321/login | grep -i "<title>"`
Expected: `<title>Log In — BoldShare</title>` present. (Actually logging in requires real Supabase Auth credentials/Google OAuth config in your Supabase project — verify the form itself renders here; verify a real login round-trip once those are configured.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase-browser.ts src/components/LoginForm.tsx src/pages/login.astro
git commit -m "feat: add login page with password, magic link, and Google sign-in"
```

---

### Task 8: OAuth/magic-link callback + logout + Header wiring

**Files:**
- Create: `src/pages/auth/callback.astro`
- Create: `src/components/LogoutButton.tsx`
- Modify: `src/components/Header.astro`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 6), `createSupabaseBrowserClient` (Task 7), `Astro.locals.user` (Task 5/6).

- [ ] **Step 1: Implement `src/pages/auth/callback.astro`**

```astro
---
import { createSupabaseServerClient } from '../../lib/supabase-server';

const code = Astro.url.searchParams.get('code');

if (code) {
  const supabase = createSupabaseServerClient(Astro.request, Astro.cookies);
  await supabase.auth.exchangeCodeForSession(code);
}

return Astro.redirect('/file-sharing');
---
```

- [ ] **Step 2: Implement `src/components/LogoutButton.tsx`**

```tsx
import React from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';

const supabase = createSupabaseBrowserClient();

const LogoutButton = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <button onClick={handleLogout} className="font-black uppercase text-sm hover:text-[#FF00E4] transition-colors">
      Log Out
    </button>
  );
};

export default LogoutButton;
```

- [ ] **Step 3: Modify `src/components/Header.astro`**

Replace the `<nav>` block and the trailing `<div class="flex items-center gap-4">` block:

```astro
---
import { Sparkles } from 'lucide-react';
import SupportButton from './SupportButton';
import LogoutButton from './LogoutButton';

const user = Astro.locals.user;
---

<header class="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b-4 border-black px-4 py-4 sm:px-8">
  <div class="max-w-7xl mx-auto flex justify-between items-center">
    <a href="/" class="group flex items-center gap-2">
      <div class="bg-[#00F0FF] p-2 neo-brutal group-hover:rotate-12 transition-transform">
        <Sparkles size={24} />
      </div>
      <span class="text-2xl font-black uppercase tracking-tighter">BoldShare</span>
    </a>

    <nav class="hidden md:flex items-center gap-6 font-black uppercase text-sm">
      <a href="/#features" class="hover:text-[#FF00E4] transition-colors">Features</a>
      <a href="/#faq" class="hover:text-[#FF00E4] transition-colors">FAQ</a>
      {user && <a href="/dashboard" class="hover:text-[#FF00E4] transition-colors">Dashboard</a>}
    </nav>

    <div class="flex items-center gap-4">
      {user ? (
        <LogoutButton client:load />
      ) : (
        <a href="/login" class="font-black uppercase text-sm hover:text-[#FF00E4] transition-colors">Log In</a>
      )}
      <SupportButton client:load />
    </div>
  </div>
</header>
```

- [ ] **Step 4: Verify the build succeeds**

Run: `npm run build`
Expected: no build errors. `Header.astro` now reads `Astro.locals.user`, which the middleware from Task 6 always sets (to `null` when logged out), so this works with no live session too.

- [ ] **Step 5: Commit**

```bash
git add src/pages/auth/callback.astro src/components/LogoutButton.tsx src/components/Header.astro
git commit -m "feat: add auth callback, logout, and header login state"
```

---

### Task 9: Protect file uploads and enforce quota

**Files:**
- Modify: `src/pages/api/get-upload-url.ts`
- Modify: `src/pages/api/finalize-upload.ts`
- Modify: `src/components/FileUploader.tsx`
- Modify: `src/pages/file-sharing.astro`

**Interfaces:**
- Consumes: `getUsageBytes`, `getSubscriptionStatus` (Task 4), `hasQuota`, `getLimitBytes` (Task 3), `Astro.locals.user` (Task 5/6).

- [ ] **Step 1: Modify `src/pages/api/get-upload-url.ts`**

```ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { nanoid } from 'nanoid';
import { getUsageBytes, getSubscriptionStatus } from '../../lib/usage';
import { getLimitBytes, hasQuota } from '../../lib/plans';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileName, fileSize } = body;

    if (!fileName || !fileSize) {
      return new Response(JSON.stringify({ error: 'Filename and file size are required' }), { status: 400 });
    }

    const [usage, status] = await Promise.all([
      getUsageBytes(locals.user.id),
      getSubscriptionStatus(locals.user.id),
    ]);

    if (!hasQuota(usage, fileSize, status)) {
      return new Response(
        JSON.stringify({ error: 'quota_exceeded', usage, limit: getLimitBytes(status) }),
        { status: 403 }
      );
    }

    const id = nanoid(10);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${id}-${safeFileName}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('Error creating signed URL:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), { status: 500 });
    }

    return new Response(JSON.stringify({
      signedUrl: data.signedUrl,
      path: data.path,
      id: id,
    }), { status: 200 });
  } catch (error) {
    console.error('Signed URL API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
```

- [ ] **Step 2: Modify `src/pages/api/finalize-upload.ts`**

```ts
import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { files } from '../../schema';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, fileName, fileType, fileSize, filePath, expiryMinutes } = body;

    if (!id || !fileName || !fileType || !fileSize || !filePath) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const expiresAt = expiryMinutes ? new Date(Date.now() + expiryMinutes * 60 * 1000) : null;

    await db.insert(files).values({
      id,
      userId: locals.user.id,
      name: fileName,
      type: fileType,
      size: fileSize,
      path: filePath,
      expiresAt,
    });

    return new Response(JSON.stringify({ success: true, id }), { status: 200 });
  } catch (error) {
    console.error('Finalize Upload API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save file metadata' }), { status: 500 });
  }
};
```

- [ ] **Step 3: Modify `src/components/FileUploader.tsx`**

Replace the entire `handleUpload` function with:

```tsx
  const handleUpload = async () => {
    if (!file) return;

    let minutes = parseInt(expiry === 'custom' ? customExpiry : expiry);
    if (minutes > 1440) {
      setError('Maximum expiry is 24 hours!');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Get signed upload URL
      const urlResponse = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });

      const urlData = await urlResponse.json();

      if (urlResponse.status === 403 && urlData.error === 'quota_exceeded') {
        const usedMB = (urlData.usage / (1024 * 1024)).toFixed(1);
        const limitMB = (urlData.limit / (1024 * 1024)).toFixed(0);
        throw new Error(`You've used ${usedMB}MB of your ${limitMB}MB. Delete some files, or upgrade to Premium for 1GB.`);
      }

      if (!urlResponse.ok) throw new Error(urlData.error || 'Failed to get upload URL');

      const { signedUrl, path, id } = urlData;

      // 2. Upload file directly to Supabase via the signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        let errorMsg = 'Direct upload failed';
        try {
          const errorData = await uploadResponse.json();
          errorMsg = `Supabase Error: ${errorData.message || errorData.error}`;
        } catch (e) {
          errorMsg = `Upload failed with status ${uploadResponse.status}`;
        }
        throw new Error(errorMsg);
      }

      // 3. Finalize upload metadata in the database
      const finalizeResponse = await fetch('/api/finalize-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          filePath: path,
          expiryMinutes: minutes,
        }),
      });

      const finalizeData = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalizeData.error || 'Failed to finalize upload');

      setShareUrl(`${window.location.origin}/f/${id}`);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'A network error occurred');
    } finally {
      setUploading(false);
    }
  };
```

- [ ] **Step 4: Modify `src/pages/file-sharing.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import FileUploader from '../components/FileUploader';

if (!Astro.locals.user) {
  return Astro.redirect('/login');
}

const title = 'Share Files Online Free — Temporary File Links | BoldShare';
const description = 'Upload files up to 50MB and share a link that self-destructs automatically. No signup, no tracking, automatic deletion on expiry.';
---

<Layout title={title} description={description}>
	<main>
		<FileUploader client:load />
	</main>
</Layout>
```

- [ ] **Step 5: Verify with a manual walkthrough (requires real Supabase/Postgres credentials in the environment running this)**

Run: `npm run build` — expect success.
Run: `npm run dev`, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:4321/file-sharing
```
Expected: `302` (redirect to `/login`) since there's no session cookie.
```bash
curl -s -X POST localhost:4321/api/get-upload-url -H "Content-Type: application/json" -d '{"fileName":"test.txt","fileSize":1000}'
```
Expected: `{"error":"unauthorized"}` with a `401`. A full logged-in walkthrough (upload near 50MB, confirm the next upload is rejected with `quota_exceeded`) needs a real logged-in session — re-run once Supabase Auth is configured with real credentials.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/get-upload-url.ts src/pages/api/finalize-upload.ts src/components/FileUploader.tsx src/pages/file-sharing.astro
git commit -m "feat: require login and enforce storage quota on file uploads"
```

---

### Task 10: Delete-file endpoint

**Files:**
- Create: `src/pages/api/files/[id].ts`

**Interfaces:**
- Consumes: `db`, `files` (existing), `supabase` (existing admin client), `Astro.locals.user`.
- Produces: `DELETE /api/files/:id` — consumed by `FileManager.tsx` in Task 11.

- [ ] **Step 1: Implement `src/pages/api/files/[id].ts`**

```ts
import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { files } from '../../../schema';
import { and, eq } from 'drizzle-orm';
import { supabase } from '../../../lib/supabase';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  }

  const fileInfo = await db.query.files.findFirst({ where: eq(files.id, id) });

  if (!fileInfo || fileInfo.userId !== locals.user.id) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }

  const { error: storageError } = await supabase.storage.from('uploads').remove([fileInfo.path]);
  if (storageError) {
    console.error('Failed to delete from storage:', storageError);
  }

  await db.delete(files).where(and(eq(files.id, id), eq(files.userId, locals.user.id)));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

- [ ] **Step 2: Verify unauthenticated access is rejected**

Run: `npm run dev`, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE localhost:4321/api/files/abc123
```
Expected: `401`. (Full ownership-check behavior needs a real logged-in session with an actual file row — re-verify once Supabase Auth is configured.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/files/\[id\].ts
git commit -m "feat: add authenticated file delete endpoint"
```

---

### Task 11: "My Files" dashboard

**Files:**
- Create: `src/components/FileManager.tsx`
- Create: `src/pages/dashboard.astro`

**Interfaces:**
- Consumes: `getUsageBytes`, `getSubscriptionStatus` (Task 4), `getLimitBytes` (Task 3), `DELETE /api/files/:id` (Task 10), `db`/`files` schema (existing).
- Produces: `FileManager` props: `{ files: { id: string; name: string; size: number; expiresAt: string | null }[]; usageBytes: number; limitBytes: number }`.

- [ ] **Step 1: Implement `src/components/FileManager.tsx`**

```tsx
import React, { useState } from 'react';
import { Trash2, File as FileIcon } from 'lucide-react';

interface FileRow {
  id: string;
  name: string;
  size: number;
  expiresAt: string | null;
}

interface Props {
  files: FileRow[];
  usageBytes: number;
  limitBytes: number;
}

const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

const FileManager = ({ files: initialFiles, usageBytes: initialUsage, limitBytes }: Props) => {
  const [files, setFiles] = useState(initialFiles);
  const [usageBytes, setUsageBytes] = useState(initialUsage);

  const handleDelete = async (id: string, size: number) => {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setUsageBytes((prev) => prev - size);
  };

  const percentUsed = Math.min(100, (usageBytes / limitBytes) * 100);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 py-12">
      <div className="bg-white neo-brutal p-6 space-y-3">
        <p className="font-black uppercase">
          {formatMB(usageBytes)}MB / {formatMB(limitBytes)}MB used
        </p>
        <div className="w-full h-4 border-2 border-black bg-[#F0F0F0]">
          <div className="h-full bg-[#00F0FF]" style={{ width: `${percentUsed}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {files.length === 0 && <p className="font-bold opacity-60">No active files.</p>}
        {files.map((file) => (
          <div key={file.id} className="bg-white neo-brutal p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon className="shrink-0" />
              <div className="min-w-0">
                <p className="font-black truncate">{file.name}</p>
                <p className="font-bold opacity-60 text-sm">
                  {formatMB(file.size)}MB{file.expiresAt ? ` • expires ${new Date(file.expiresAt).toLocaleString()}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(file.id, file.size)}
              className="bg-black text-white p-2 neo-brutal hover:bg-red-500 transition-colors shrink-0"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileManager;
```

- [ ] **Step 2: Implement `src/pages/dashboard.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import FileManager from '../components/FileManager';
import { db } from '../lib/db';
import { files } from '../schema';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { getUsageBytes, getSubscriptionStatus } from '../lib/usage';
import { getLimitBytes } from '../lib/plans';

if (!Astro.locals.user) {
  return Astro.redirect('/login');
}

const userId = Astro.locals.user.id;

const [activeFiles, usageBytes, status] = await Promise.all([
  db.query.files.findMany({
    where: and(eq(files.userId, userId), or(isNull(files.expiresAt), gt(files.expiresAt, new Date()))),
  }),
  getUsageBytes(userId),
  getSubscriptionStatus(userId),
]);

const limitBytes = getLimitBytes(status);

const fileRows = activeFiles.map((f) => ({
  id: f.id,
  name: f.name,
  size: f.size,
  expiresAt: f.expiresAt ? f.expiresAt.toISOString() : null,
}));
---

<Layout title="My Files — BoldShare" description="Manage your uploaded files and storage usage." noindex={true}>
  <FileManager client:load files={fileRows} usageBytes={usageBytes} limitBytes={limitBytes} />
</Layout>
```

- [ ] **Step 3: Verify unauthenticated redirect**

Run: `npm run dev`, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:4321/dashboard
```
Expected: `302`. (Full dashboard content needs a real logged-in session with real files — re-verify once Supabase Auth is configured.)

- [ ] **Step 4: Commit**

```bash
git add src/components/FileManager.tsx src/pages/dashboard.astro
git commit -m "feat: add My Files dashboard with usage meter and delete"
```

---

### Task 12: Free-tier-only ad slot

**Files:**
- Create: `src/components/AdSlot.astro`
- Modify: `src/pages/file-sharing.astro`
- Modify: `src/pages/dashboard.astro`

**Interfaces:**
- Consumes: `getSubscriptionStatus` (Task 4).
- Produces: `<AdSlot />` — renders nothing if `PUBLIC_ADSENSE_CLIENT_ID` is unset (safe no-op until you actually have an AdSense account).

- [ ] **Step 1: Implement `src/components/AdSlot.astro`**

```astro
---
const clientId = import.meta.env.PUBLIC_ADSENSE_CLIENT_ID;
---

{clientId && (
  <div class="my-6">
    <ins
      class="adsbygoogle"
      style="display:block"
      data-ad-client={clientId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
    <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`} crossorigin="anonymous"></script>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>
)}
```

- [ ] **Step 2: Wire it into `src/pages/file-sharing.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import FileUploader from '../components/FileUploader';
import AdSlot from '../components/AdSlot.astro';
import { getSubscriptionStatus } from '../lib/usage';

if (!Astro.locals.user) {
  return Astro.redirect('/login');
}

const status = await getSubscriptionStatus(Astro.locals.user.id);
const isPremium = status === 'active';

const title = 'Share Files Online Free — Temporary File Links | BoldShare';
const description = 'Upload files up to 50MB and share a link that self-destructs automatically. No signup, no tracking, automatic deletion on expiry.';
---

<Layout title={title} description={description}>
	<main>
		<FileUploader client:load />
		{!isPremium && <AdSlot />}
	</main>
</Layout>
```

- [ ] **Step 3: Wire it into `src/pages/dashboard.astro`**

Add the import and `isPremium` check alongside the existing frontmatter, and render conditionally after `<FileManager>`:

```astro
---
import Layout from '../layouts/Layout.astro';
import FileManager from '../components/FileManager';
import AdSlot from '../components/AdSlot.astro';
import { db } from '../lib/db';
import { files } from '../schema';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { getUsageBytes, getSubscriptionStatus } from '../lib/usage';
import { getLimitBytes } from '../lib/plans';

if (!Astro.locals.user) {
  return Astro.redirect('/login');
}

const userId = Astro.locals.user.id;

const [activeFiles, usageBytes, status] = await Promise.all([
  db.query.files.findMany({
    where: and(eq(files.userId, userId), or(isNull(files.expiresAt), gt(files.expiresAt, new Date()))),
  }),
  getUsageBytes(userId),
  getSubscriptionStatus(userId),
]);

const limitBytes = getLimitBytes(status);
const isPremium = status === 'active';

const fileRows = activeFiles.map((f) => ({
  id: f.id,
  name: f.name,
  size: f.size,
  expiresAt: f.expiresAt ? f.expiresAt.toISOString() : null,
}));
---

<Layout title="My Files — BoldShare" description="Manage your uploaded files and storage usage." noindex={true}>
  <FileManager client:load files={fileRows} usageBytes={usageBytes} limitBytes={limitBytes} />
  {!isPremium && <AdSlot />}
</Layout>
```

- [ ] **Step 4: Verify no ads render without the env var (expected state until AdSense is set up)**

Run: `npm run build`
Expected: success. Run: `npm run dev`, then `curl -s localhost:4321/file-sharing | grep -c adsbygoogle` after logging in via a real session — expect `0` since `PUBLIC_ADSENSE_CLIENT_ID` isn't set anywhere yet; set it in `.env` and repeat to confirm the ad markup appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdSlot.astro src/pages/file-sharing.astro src/pages/dashboard.astro
git commit -m "feat: show ads to free-plan users only"
```

---

### Task 13: Full integration verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: success, no errors.

- [ ] **Step 2: Unit tests**

Run: `npm run test`
Expected: all `plans.test.ts` cases pass.

- [ ] **Step 3: Unauthenticated behavior**

With `npm run dev` running:
```bash
curl -s -o /dev/null -w "/file-sharing -> %{http_code}\n" localhost:4321/file-sharing
curl -s -o /dev/null -w "/dashboard -> %{http_code}\n" localhost:4321/dashboard
curl -s -o /dev/null -w "/login -> %{http_code}\n" localhost:4321/login
curl -s -o /dev/null -w "/text-sharing -> %{http_code}\n" localhost:4321/text-sharing
```
Expected: `/file-sharing` and `/dashboard` are `302`; `/login` and `/text-sharing` are `200`.

- [ ] **Step 4: Text-sharing untouched**

```bash
curl -s -X POST localhost:4321/api/share -H "Content-Type: application/json" -d '{"content":"<p>still anonymous</p>"}'
```
Expected: `{"id":"..."}` with `200` and no login required — confirms text sharing has zero auth changes.

- [ ] **Step 5: Logged-in walkthrough (requires real Supabase Auth + Postgres credentials)**

Manually, in a browser with real credentials configured:
1. Sign up at `/login`, confirm redirect to `/file-sharing`.
2. Upload files until within a few MB of 50MB total.
3. Attempt one more upload that would exceed it — confirm the inline `quota_exceeded` message appears and no file lands in Supabase Storage (check the bucket).
4. Visit `/dashboard` — confirm the usage bar matches, delete a file, confirm the bar drops immediately.
5. Log out via the header button, confirm `/file-sharing` and `/dashboard` redirect to `/login` again.

Note explicitly in your report which of these you were able to run given the credentials available in your environment, and which still need to be run wherever real Supabase/Google OAuth credentials exist.

- [ ] **Step 6: Commit (only if any fixes were needed during this pass)**

```bash
git add -A
git commit -m "fix: address issues found during integration verification"
```
