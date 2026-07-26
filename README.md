# Portfolio — Khalid Ahammed

A full-stack portfolio and content-management system. A React client presents
project case studies and an optional interactive 3D scene; an Express API owns
projects, settings, media processing, administrator workflows, and outbound
messaging.

![Website demo](demo.gif)

The interesting part is not the feature list — it is small. This repository is
built the way a system that has to survive a production incident is built:
explicit boundaries, fail-closed defaults, data integrity treated as a
first-class concern, and every performance and correctness claim backed by a
gate that fails the build rather than a sentence in a document.

---

## Contents

- [Engineering principles](#engineering-principles)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Data integrity](#data-integrity)
- [Media pipeline](#media-pipeline)
- [Frontend engineering](#frontend-engineering)
- [Search correctness](#search-correctness)
- [Operability](#operability)
- [How correctness is verified](#how-correctness-is-verified)
- [Operations](#operations)
- [Configuration](#configuration)
- [Trade-offs and limitations](#trade-offs-and-limitations)
- [Assets and licensing](#assets-and-licensing)

---

## Engineering principles

Five rules the codebase follows consistently. Each section below is a
demonstration of them rather than a restatement.

**Fail closed.** A missing secret, a pending migration, an unverifiable TLS
certificate, or a schema that does not match the release stops the process at
startup. A system that refuses to boot is diagnosable; one that boots and serves
corrupt reads is not.

**Allowlist, never filter.** Request bodies, response DTOs, upload fields, and
file types are enumerated explicitly and unknown input is rejected outright.
Filtering silently is how a new database column becomes an accidental public API.

**Make the unsafe state unrepresentable.** Where a rule can be enforced by
structure rather than discipline, it is: paths that cannot escape a root,
sessions that cannot outlive a password rotation, media names that cannot
collide.

**Prefer a loud failure to a quiet one.** Ambiguous outcomes — a database commit
whose acknowledgement was lost, a provider call that timed out mid-flight — are
resolved toward preserving data and surfacing the ambiguity, never toward a
convenient guess.

**If it is not measured, it is not true.** Bundle sizes, coverage floors, and
media integrity are enforced by tooling that fails the build. Numbers in this
document are measurements, not targets.

---

## Architecture

### Boundaries

```
Browser ──▶ /api/*      ──▶ router ──▶ auth ──▶ validation ──▶ controller ──▶ model
       └──▶ /uploads/*  ──▶ static, cache-policy by filename shape
```

Each layer has one responsibility and does not reach past its neighbour.
Routers declare the middleware chain and nothing else. Controllers validate,
shape, and never touch the filesystem directly. Path resolution, provider
execution, and lifecycle live in dedicated utilities so their invariants are
testable in isolation.

### Stack

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Runtime | Node.js 24 LTS, npm 11 | Pinned via `.nvmrc` and `engines`; lockfiles committed |
| Client | React 19, React Router 7, Vite 8, Tailwind 4 | Route-level code splitting; no runtime CSS-in-JS cost |
| 3D | Three.js, dynamically imported | Deferred behind explicit opt-in and capability checks |
| API | Express 5, Sequelize 6, MySQL 8 | Transactional guarantees required for media-plus-row mutations |
| Media | Sharp | Decodes and re-encodes rather than trusting uploaded bytes |
| Tests | Vitest, Node.js test runner | No test framework in production dependencies |

### Layout

```
client/
  src/
    axios/         API client; endpoints declared in one place
    components/    UI grouped by feature area, not by file type
    pages/         Route components; each owns its own metadata
    animations/    GSAP and Lenis integration, isolated from view logic
    hooks/ utils/  Capability detection, response validation, formatting
  scripts/         Bundle budget, dependency audit, sitemap generation
server/
  routers/         Route tables and middleware composition
  controllers/     Validation, orchestration, DTO shaping
  middlewares/     Auth, upload pipeline, error and 404 normalization
  models/          Sequelize definitions
  migrations/      Ordered, first-party, forward-only
  utils/           Path safety, provider execution, lifecycle, readiness
  scripts/         Migration runner, admin tooling, media integrity
```

Grouping by feature rather than by type means a change to project media touches
one neighbourhood instead of five parallel directories.

---

## Security model

**Sessions.** A signed, `httpOnly`, `SameSite=Strict` cookie carries a JWT with a
pinned algorithm, audience, and issuer — signature verification alone is not
enough if an attacker can choose the algorithm. Every request re-validates
against the database and compares a `sessionVersion` claim, so rotating a
password invalidates outstanding sessions immediately rather than waiting for
expiry.

**Login timing.** An unknown username is compared against a real bcrypt hash
rather than returning early. Without this, response latency distinguishes "no
such user" from "wrong password" and enumerates accounts.

**Request origin.** Unsafe methods require an exact, configured origin. CORS
alone does not prevent CSRF; this is a separate check on a separate axis.

**Mass assignment.** Controllers accept explicit field allowlists and reject
unknown fields with an error rather than dropping them. Responses are shaped
through DTO allowlists, so a new column is invisible until deliberately exposed.

**Input normalization.** Text is NFKC-normalized, control characters rejected,
and length bounded in both characters *and* UTF-8 bytes — a character limit alone
still permits a payload that overflows a `TEXT` column.

**Transport and headers.** Helmet with an explicit deny-by-default CSP, HSTS in
production, and mandatory verified TLS for production database connections
including `DATABASE_URL` deployments.

---

## Data integrity

### Migrations adopt, they do not assume

Most migration suites assume a clean database. Real ones inherit a schema built
by an ORM's `sync()`. This chain adopts an existing schema: it converts
non-transactional tables to InnoDB, normalizes charset and collation, then runs
an exact preflight that rejects unknown columns, wrong widths, invalid slugs,
malformed JSON, and non-contiguous ordering.

Failures surface for deliberate resolution. Nothing is silently truncated or
rewritten — a migration that "fixes" data by discarding it is a data-loss bug
with good intentions.

Migrations are forward-only and executed under a MySQL advisory lock. Startup
refuses to serve unless the applied inventory is a contiguous prefix of the
release's migrations, so a half-migrated database fails closed.

> Worth noting: the advisory lock originally passed a reserved connection to
> `sequelize.query()`, which Sequelize 6 silently ignores — the lock and its
> release ran on different pooled sessions. Every run ended with a spurious
> release failure and the mutual exclusion never actually held. It was found by
> running the chain against a real MySQL instance, not by unit tests, because the
> test double faithfully simulated an option the real library does not support.
> Lock statements now issue directly on the reserved driver connection.

### Ambiguous commits

Media and database rows are mutated together. When a commit's acknowledgement is
lost, the outcome is genuinely unknown: the row may or may not exist. Rather than
guessing, the code re-reads the committed state and only deletes files the
committed row does not reference. Preserving an orphaned file is recoverable;
deleting a file a live row points at is not.

### Transactions and locking

Project mutations run inside transactions with row-level locks. Reordering
applies updates serially on one connection so a partial reorder cannot be
reported as success. Slug generation checks under lock, with a unique constraint
as the final arbiter — an application-level check alone is a race.

---

## Media pipeline

Uploaded bytes are treated as hostile until proven otherwise.

1. **Naming.** The client's filename and extension are discarded. A random name
   with a fixed, known-safe extension is generated, so active-content filenames
   and collisions are structurally impossible.
2. **Signature.** Magic bytes are verified through an `O_NOFOLLOW` file handle,
   closing the window where a local symlink swap redirects validation to a
   different file between write and read.
3. **Re-encoding.** Images are decoded through Sharp under an explicit pixel
   ceiling, resized, EXIF-stripped, and re-encoded to WebP. The output is a file
   this system produced, not one an uploader supplied. Processing is sequential
   to bound peak native memory.
4. **Deletion.** Confined to the uploads root, refusing any path that escapes
   through a symlink.

**Caching contract.** Generated names are served `immutable` for one year and
must never be overwritten — a replacement receives a new name. Files that do not
match the generated shape fall back to revalidation, so legacy uploads stay
correct without weakening the policy for new ones.

**Portability.** Paths are stored relative and resolved at runtime against a
configurable root, so a database dump restores onto any host without rewriting a
row. `media:verify` cross-checks every reference against disk and exits non-zero
on the first discrepancy, making it usable as a deployment gate. Without such a
check, a partial media copy surfaces only when a visitor loads a broken page.

---

## Frontend engineering

**Rendering budget.** Routes are code-split; the 3D scene is dynamically imported
and never loads on its own. It requires explicit user intent and respects
Save-Data, connection quality, reduced-motion, pointer capability, WebGL
availability, and document visibility, pausing when off-screen. Treating an
expensive enhancement as opt-in is what keeps the critical path small.

**Measured on the production build** (desktop Chrome, live API):

| Route | FCP | LCP | CLS | Long tasks |
| --- | --- | --- | --- | --- |
| Home | 112 ms | 460 ms | 0.024 | 0 |
| Projects | 104 ms | 456 ms | 0.001 | 0 |
| About | 96 ms | 444 ms | 0.000 | 0 |
| Project detail | 84 ms | 952 ms | 0.000 | 0 |

Critical JavaScript is 217 KiB gzip against a 235 KiB budget enforced by the
build.

**Layout stability.** The project page once measured 0.22 CLS, well past Google's
0.1 threshold. Attribution pointed at a short loading placeholder collapsing into
a full-height article — a single 0.2205 shift, not the images that were the
obvious suspect. The placeholder now reserves the loaded height and the banner
reserves its own box. That page measures 0.000.

**Failure states are designed, not incidental.** Data loading has real loading,
error, and retry states. A media file that no longer exists degrades to a
placeholder rather than the browser's broken-image glyph, so one missing file
does not make a page look defective.

---

## Search correctness

Client-rendered applications commonly get metadata subtly wrong in ways that
suppress ranking without any visible symptom.

`index.html` ships a complete, valid default metadata set plus a
Person/WebSite/ProfilePage identity graph, so crawlers and link unfurlers that
never execute JavaScript still receive correct information. At runtime each route
rewrites *those same elements in place* through an upsert.

The distinction matters. The previous library appended instead of replacing, so
every page served two or three titles and canonicals — and on the projects page
the canonicals disagreed outright, one claiming the homepage and one claiming the
page itself. Search engines resolve conflicting canonicals by discarding all of
them, meaning no interior page could establish its own identity. Upsert semantics
make that state unrepresentable.

Project pages publish a `CreativeWork` entry. Administrator and error pages send
`noindex, nofollow` and deliberately withhold a canonical link — advertising a
canonical URL for a page you are excluding invites indexing of the very URL the
directive excludes. Unknown URLs render a real 404 rather than a soft 404 that
returns the site's default title. `sitemap.xml` is generated at build time from
the live catalogue, because a hand-maintained sitemap goes stale the moment a
project is added.

---

## Operability

**Health.** Liveness and readiness are separate endpoints — conflating them makes
an orchestrator restart a process that is merely waiting on a dependency.
Readiness probes are coalesced so a burst of checks does not become a burst of
database queries.

**Shutdown.** A single monotonic deadline governs draining, database close, and
provider cleanup, with a deterministic exit on a second signal. Deadlines derived
from wall-clock time are wrong across a clock adjustment.

**Outbound providers.** Mail and SMS run under bounded concurrency and absolute
deadlines. A timed-out task keeps occupying its slot until the underlying
operation actually settles, so a provider that ignores cancellation cannot
accumulate unbounded in-flight work.

**Errors.** Normalized to safe JSON with no internal detail; API 404s are
non-cacheable so a transient miss is not cached as permanent.

---

## How correctness is verified

```bash
npm run check          # syntax, coverage floors, tests, lint, budgeted build
npm run audit:server
npm run audit:client   # audit with documented, expiring exceptions
```

| Gate | Enforcement |
| --- | --- |
| Server tests | 180 passing, Node.js test runner |
| Client tests | 56 passing across 20 files |
| Coverage floors | 80% lines / 70% branches / 75% functions — build fails below |
| Lint | Zero warnings tolerated |
| Bundle budgets | Seven asset budgets; build fails on regression |
| Media integrity | `media:verify` exits non-zero on any broken reference |
| Supply chain | Dependency audit, full-history secret scan, CycloneDX SBOM |

CI runs clean installs on pinned action SHAs. Dependency exceptions carry a
written rationale and an expiry date rather than being suppressed indefinitely.

Tests target invariants rather than implementation: that a spoofed file removes
every uploaded file in the request, that a failed migration is never recorded as
applied, that concurrent runs serialize, that a private page emits no canonical.

---

## Operations

### Moving hosts

Database rows and uploaded bytes must travel together; stored paths are relative,
so no row changes.

1. Set `UPLOADS_DIR` to storage that outlives the application directory.
2. Copy the uploads root preserving structure, timestamps, and exact filenames:

   ```bash
   rsync -a --delete /old/uploads/ /new/uploads/
   ```

   Filenames are case-sensitive on Linux. Never rename, re-case, or re-encode a
   file — generated names are cached immutably for a year.
3. Restore the database and run the migration chain.
4. Run `media:verify` before sending traffic.

### Commands

```bash
npm run media:verify --prefix server      # every DB reference resolves to a readable file
npm run media:orphans --prefix server     # files no project references; reports only
npm run db:migrate:status --prefix server # applied vs pending inventory
npm run admin:bootstrap --prefix server   # create the initial administrator
npm run admin:rotate --prefix server      # rotate password; invalidates sessions
```

Passwords are read from a hidden prompt or standard input, never from an argument
or environment variable, so they do not reach shell history or the process table.

### Deployment

1. Back up the database and media volume, then **verify a restore**. The baseline
   migration is intentionally irreversible; rollback depends on this backup.
2. Run the chain against a restored copy of production data and resolve every
   preflight failure deliberately. Never edit a recorded migration.
3. Run `db:migrate:production` as a release step; startup refuses a pending or
   unrecognized inventory.
4. Bootstrap or rotate the administrator and set the matching `ADMIN_USERNAME`.
5. Provide distinct strong secrets, exact origins, the true proxy hop count, and
   `DB_SSL=true` with certificate verification.
6. Point `UPLOADS_DIR` at persistent storage; provision the resume PDF.
7. Serve `client/dist` over HTTPS with SPA fallback, proxying `/api` and
   `/uploads`. Keep client and API on the same site while cookies use
   `SameSite=Strict`.
8. Mirror body, header, and connection limits at the edge, at least as strictly.
   Application limits alone are not DoS protection.
9. Verify health endpoints, run `media:verify`, then smoke-test public routes,
   login, upload, mail, and SMS.

`sequelize.sync()` must never run against production.

---

## Configuration

Both packages read uncommitted `.env` files; `.env.example` documents every
value. Startup validation is fail-closed rather than defaulting silently.

| Variable | Purpose |
| --- | --- |
| `ADMIN_SECRET`, `COOKIE_SECRET` | Distinct secrets, 32+ characters |
| `DATABASE_URL` *or* `DB_*` | Connection; `DB_SSL=true` mandatory in production |
| `REMOTE_CLIENT_APP` | Exact allowed origins; HTTPS in production |
| `TRUST_PROXY_HOPS` | Exact trusted hop count, never blanket proxy trust |
| `UPLOADS_DIR` | Absolute media root; unset keeps media beside the application |
| `RESUME_FILE_PATH` | Absolute path to a signature-valid PDF, 20 MiB ceiling |
| `HTTP_*`, `*_BODY_LIMIT` | Request, header, keep-alive, and connection limits |
| `*_RATE_LIMIT_*` | Per-window request ceilings |
| `MAIL_*`, `SMS_*` | Provider credentials, timeouts, pool bounds |

Client-side: `VITE_API_URL` at runtime (leave empty for same-origin deployments);
`SITE_ORIGIN` and `SITEMAP_API_URL` at build time. Only `VITE_`-prefixed values
reach the browser.

---

## Trade-offs and limitations

Stated plainly, because a system's boundaries matter as much as its capabilities.

**Per-project link previews.** Metadata is applied after the SPA executes. Google
renders JavaScript and reads it, but social unfurlers do not, so a shared project
link previews with the site-level card. Prerendering or SSR is the only real fix;
it was scoped out rather than half-implemented.

**Single-instance media.** Local disk is not shared between replicas. Multiple API
instances require object storage or a shared volume, plus quotas and orphan
reconciliation.

**Rate limiting is per-process** and resets on restart. It is a fairness control,
not DoS protection — that belongs at the edge.

**MP4 uploads** are bounded and signature-checked but not transcoded, probed, or
malware-scanned. Adequate for a single trusted uploader; not for untrusted input.

**Sitemap coverage** depends on `SITEMAP_API_URL` at build time. Without it the
build succeeds but lists static routes only.

**Not yet evidenced:** production-like accessibility and contrast auditing, load
testing, and a staging soak.

---

## Assets and licensing

Interface design:
[Figma](https://figma.com/design/6vj7AuSx5mTlBdbnVBwX7V/Protfolio-website?node-id=0-1&t=4qtQNdvFahT0lXpZ-1).

This repository is **source-available, not open source**. It is published so the
engineering can be read and evaluated; it is not a template. Copying, deploying,
or reusing the design, content, or media requires written permission. See
[LICENSE](LICENSE) for the exact terms — package metadata is marked `UNLICENSED`
to match, so no tooling infers a permissive grant.

Third-party material keeps its own terms, which override that notice.
`client/public/scene.glb` identifies its source model as CC BY-NC 4.0;
attribution appears in the site footer, but a portfolio promoting paid services
may not satisfy the non-commercial restriction, so the model needs replacing or
explicit commercial permission before commercial deployment. Bundled fonts
remain under their respective licenses.
