# Deployment

Read this before deploying the modernized server. Some changes are deliberately
breaking: the server now refuses to start on a misconfiguration rather than
running with a weak default.

## Required before the first deploy

### 1. New environment variables — the server will not boot without these

| Variable | Why |
|---|---|
| `COOKIE_SECRET` | Session cookies were signed with the literal string `'secret'`, hardcoded in `index.js`. Anyone who read the repository could forge a validly signed cookie. **Must differ from `ADMIN_SECRET`.** |
| `REMOTE_CLIENT_APP` | Already used, but a missing value now fails at startup instead of throwing a `TypeError` mid-request. Comma-separated exact origins. |
| `ADMIN_SECRET` | Already used; now length-checked in production. |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

In production the server also rejects secrets shorter than 32 characters, and
rejects `COOKIE_SECRET === ADMIN_SECRET`.

**Rotating `COOKIE_SECRET` invalidates every existing administrator session.**
That is intended — the old value was public.

See `server/.env.example` for the full list including the optional tuning
variables (`TRUST_PROXY_HOPS`, body limits, rate limits, pool sizing).

### 2. `TRUST_PROXY_HOPS` must match the deployment

Set it to the number of reverse proxies in front of the app. Too low and every
visitor shares the proxy's address, so rate limits bucket them together. Too
high and a client can forge `X-Forwarded-For` and appear as any address it
likes. Direct exposure with no proxy is `0`.

### 3. Database TLS is mandatory in production

The server refuses to connect to a production database without it. Set `DB_SSL`
and, where the provider requires it, `DB_SSL_CA`. Certificate verification is
always on; there is no option to disable it in production.

### 4. Run migrations — the schema is no longer created implicitly

`sequelize.sync()` no longer runs on boot. Deploy sequence:

```bash
cd server
npm ci --omit=dev
npm run migrate:status   # review what will be applied
npm run migrate          # apply
npm start
```

The baseline migration uses `IF NOT EXISTS` throughout and adopts an existing
schema untouched, so it is safe against the current production database. Take a
backup first regardless.

### 5. Administrator accounts are created from a shell

`POST /api/admin/reg` is gone; it was unauthenticated and handed out full
administrator sessions to anyone.

```bash
npm run admin:bootstrap   # first account; refuses if one already exists
npm run admin:rotate      # change a password, after proving the old one
```

Passwords are read from a hidden prompt, never from arguments.

### 6. `UPLOADS_DIR` should point at persistent storage

The default puts uploaded media inside the application directory, so any deploy
that replaces that directory destroys every uploaded file. Point it at a mounted
volume. Existing database rows store relative paths and resolve against whatever
root is configured, so no data needs rewriting.

## Client build

The API origin is no longer hardcoded. Set it at build time:

```bash
cd client
VITE_API_URL=https://api.khalidahammed.com npm run build
```

Without it the build falls back to `http://localhost:8000`, which is correct for
local development and wrong for production.

## Visual verification, and the harness noise floor

Every computed style, layout dimension, element count and colour is identical to
the previous build across 8 routes × 3 viewports. Screenshots are identical too,
apart from a measured noise floor.

Two screenshots — `about__mobile__s0` and `home__tablet__s0`, the two dominated
by GSAP-driven text animation — vary by 1–2 pixels **between two captures of the
same unchanged build**. Those animations settle against real time, so their
glyphs rasterise a subpixel apart depending on machine load. The comparator
allows 2 pixels per image for that reason, and the figure came from measuring
it, not from picking a number that passed.

This took three attempts to get right, and the first two answers were wrong:

1. A single-page harness blamed the cursor-grid change. It used a cold browser
   on one route and did not reproduce real conditions.
2. Bisection in the full harness blamed code splitting. That harness seeded
   `Math.random`, which only reproduces if both builds draw from it in the same
   order — and upgrading React Router changed the number of startup draws by
   one, desynchronising every subsequent value. Since this site picks its
   scrambled characters and per-word opacities from `Math.random`, that alone
   moved glyph rendering.
3. Stubbing `Math.random` to a constant made it phase-independent. What remained
   was reproduced by capturing one build twice — i.e. it is the harness, not any
   change.

So no change in this work alters the site's rendering. Anything above the floor,
and any difference at all in a computed style, still fails the gate.

## Behaviour changes worth knowing

- API 404s return JSON rather than HTML.
- An expired administrator session returns 403 rather than 500.
- An unknown username at login returns the same 401 and message as a wrong
  password, so the login screen no longer names a missing account.
- Responses carry security headers; `/uploads` sends `X-Content-Type-Options:
  nosniff` and long-lived caching for generated filenames.
- Uploads are validated by file signature. A file whose bytes do not match a
  supported media type is rejected regardless of its name or declared type.

## Verifying a change

Three gates, documented in `verification/README.md`:

```bash
cd verification
node run.mjs                    # visual: 53 screenshots + computed styles
node api-contract.mjs check --serve   # API contract
node bundle-budget.mjs check    # bundle size ceilings
```

The visual gate needs the frozen baseline worktree:

```bash
git worktree add ../my_portfolio-baseline bf1d462
cd ../my_portfolio-baseline/client && npm ci && npm run build
```

## Still outstanding

These are not addressed by this work and remain real:

- Database and upload backup/restore has not been proven.
- No staging environment exists; nothing here has run against production data.
- SMTP and SMS delivery are not exercised against provider sandboxes.
- Rate limits are in-process and reset on restart. They are not DoS protection;
  that belongs at the proxy or CDN.
- `scene.glb` is 1.4 MB and CC BY-NC 4.0. Both the size and the licence for a
  portfolio advertising paid work deserve a decision.
- The repository's CC BY-ND licence conflicts with `server/package.json` saying
  ISC. Pick one.

## Accepted advisories

Two advisories are knowingly not fixed. Both were checked rather than assumed.

**`react-router` GHSA-qwww-vcr4-c8h2 (high)** — an RSC-mode CSRF bypass. This is
a Vite SPA using `createBrowserRouter` and `RouterProvider`; it has no RSC mode
and no server component runtime, so the vulnerable code path does not exist
here. The fixed version is 8.3.0, **which is not published** — 7.18.1 is the
latest release. npm proposes "downgrade to 7.11.0", which would reintroduce the
open-redirect XSS in the router itself (advisory range 6.0.0-alpha.0 - 7.17.0),
a bug that *does* apply to this app.
Staying on 7.18.1 is strictly safer. Re-check when React Router 8.3.0 ships.

**`sequelize` and `uuid` (moderate, server)** — reached through
`sequelize@6.37.8`, the newest stable v6. The `sequelize` advisory range is
`0.0.0-development || >=3.30.1`, i.e. every version ever published, and npm's
proposed remedy for both is downgrading to Sequelize 3.30.0, a 2017 release.
Clearing them properly means Sequelize 7, still alpha.

Everything else is resolved: server 29 → 0 fixable, client 30 → 2 (both the
React Router item above).
