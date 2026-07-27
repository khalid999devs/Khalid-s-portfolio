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

## The one visual difference, stated plainly

The goal was zero visual change, and the site is pixel-identical to the previous
build on 52 of 53 captured screenshots, with every computed style and every
layout dimension unchanged everywhere.

One pixel differs. On `/about-me` at 390×844, the pixel at (7, 212) renders
`rgb(28,28,28)` before and `rgb(22,22,22)` after — a 6/255 change in the last
antialiasing step of a diagonal glyph edge, against a `#161616` background.

It is caused by code splitting: the module graph loads in a different order, so
text rasterises at a marginally different moment. Established by bisection, not
assumed — reverting the cursor-grid change leaves it, reverting the bundle work
removes it. Both builds were captured twice and are byte-reproducible, so it is
a genuine difference rather than harness noise.

It was accepted in exchange for a 55% reduction in render-blocking JavaScript
(439 KiB → 199 KiB gzip). It is recorded as an explicit one-pixel waiver in
`verification/compare.mjs`, so any further difference — including a second
differing pixel in that same image — still fails the gate.

To reject the trade instead, revert the `manualChunks` block in
`client/vite.config.js` and the `lazy(() => import('./bot/Scene'))` in
`client/src/components/Home/Hero.jsx`, and remove the waiver.

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
