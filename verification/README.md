# Verification harness

Proves that a change did not alter the site. Every phase of the modernization is
gated on this, and nothing merges without it passing.

It exists because the previous attempt at this work reported "verified in a real
browser, performance top-notch" while every Tailwind spacing utility on the site
computed to `0px` and the hero's 3D bot had silently become a static image. Both
regressions shipped. Load metrics measured on the new build in isolation said
nothing about correctness — only a comparison against a known-good build can.

## The three gates

| Gate | Command | Asserts |
|---|---|---|
| Visual | `node run.mjs` | Screenshots identical at **0 pixel tolerance**, and ~30 computed CSS properties across 24 element groups identical, across 8 routes × 3 viewports × up to 6 scroll positions |
| Contract | `node api-contract.mjs check` | 27 HTTP requests return the same status, content type, security-header set, and normalized body |
| Budget | `node bundle-budget.mjs check` | No gzip bundle group grew |

## Layout

```
fixtures/          recorded API responses + the 26 media files they reference
mock-api.mjs       serves those fixtures on :8000 (both builds get identical data)
static-server.mjs  serves a built dist/ with SPA fallback
capture.mjs        drives Chromium, writes PNGs + computed-style probes
compare.mjs        diffs baseline vs candidate, exit code is the gate
run.mjs            orchestrator
api-contract.mjs   server HTTP contract snapshot/check
bundle-budget.mjs  gzip size ceilings
snapshots/         committed baselines for the contract and budget gates
output/            capture results (gitignored)
```

## Setup

```bash
npm install && npx playwright install chromium

# the frozen known-good reference — never changes
git worktree add ../my_portfolio-baseline bf1d462
cd ../my_portfolio-baseline/client && npm ci && npm run build
```

## Usage

```bash
cd client && npm run build          # build the candidate first
cd ../verification

node run.mjs                        # full: capture baseline + candidate, compare
node run.mjs --candidate            # reuse the stored baseline capture (much faster)
```

Failures are written to `output/diff/` as pixel-diff PNGs alongside a line-by-line
report naming the exact CSS property that moved.

## Why it is built the way it is

**Fixtures, not the live database.** The local MySQL holds test rows and an empty
settings table, which would leave most of the real UI unrendered and therefore
unverified. Fixtures were recorded from the public read endpoints of
`api.khalidahammed.com` — the same requests any browser makes on a visit — so the
harness checks the site as it actually ships, offline and deterministically.

**Seeded `Math.random`.** Every entrance animation on this site is randomised:
scrambled characters during text blink, per-word opacity, per-letter durations.
Without seeding, the harness differs from *itself* between runs, and a harness
that is noisy against itself cannot prove anything about a change.

**The 3D canvas is masked, not compared.** GPU rasterisation will never match
pixel for pixel across runs. It is asserted structurally instead — canvas
present, non-zero dimensions, live WebGL context — which is precisely the check
that would have caught the bot silently degrading to a static image.

**A first-party static server, not `vite preview`.** Vite is itself under
upgrade. Holding the delivery layer fixed means any pixel difference is
attributable to the build, not the previewer.

**Zero tolerance, not "small".** A per-phase tolerance is a licence for drift to
accumulate across phases while each one individually looks clean.

## Refreshing fixtures

`fixtures/` is a point-in-time copy of live content. If the real site's projects
or settings change, re-record and re-capture the baseline — otherwise the harness
verifies a site that no longer exists. Fixture changes invalidate every stored
capture.
