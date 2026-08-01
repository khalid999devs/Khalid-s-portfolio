#!/usr/bin/env bash
# Builds both client variants into deploy/, which is what .cpanel.yml ships.
#
# The build runs here, not on the host: cPanel's deploy shell has no node on
# PATH, shared hosting would not survive compiling the three.js stack, and two
# variants have to come out of one commit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT="$ROOT/client"
DEPLOY="$ROOT/deploy"

API_URL="https://api.khalidahammed.com"
WEB_ORIGIN="https://khalidahammed.com"
UPWORK_ORIGIN="https://upwork.khalidahammed.com"

# Inline environment wins over client/.env: Vite copies matching process.env
# keys over the file's values last, and process.loadEnvFile leaves an already
# set value alone. Both checked against the installed versions.
build() {
  local flag="$1" origin="$2" sitemap_api="$3" out="$4"

  ( cd "$CLIENT" \
    && VITE_API_URL="$API_URL" \
       VITE_IS_UPWORK="$flag" \
       SITE_ORIGIN="$origin" \
       SITEMAP_API_URL="$sitemap_api" \
       npm run build )

  rm -rf "$out"
  mkdir -p "$out"
  rsync -a "$CLIENT/dist/" "$out/"
}

echo "==> normal"
build false "$WEB_ORIGIN" "$API_URL" "$DEPLOY/web"
cp "$ROOT/scripts/htaccess/web.htaccess" "$DEPLOY/web/.htaccess"

echo "==> upwork"
# Empty SITEMAP_API_URL skips the catalogue request; this copy is not indexed.
build true "$UPWORK_ORIGIN" "" "$DEPLOY/upwork"
cp "$ROOT/scripts/htaccess/upwork.htaccess" "$DEPLOY/upwork/.htaccess"
printf 'User-agent: *\nDisallow: /\n' > "$DEPLOY/upwork/robots.txt"
rm -f "$DEPLOY/upwork/sitemap.xml"

# The upwork build must not carry the contact address at all, not merely avoid
# rendering it. Rolldown folds the isUpwork constant and drops the branch --
# this is what catches the day it stops doing that. The second check is the
# control: it proves the first one is capable of failing.
if grep -rq 'khalidahammeduzzal' "$DEPLOY/upwork/assets"; then
  echo "FAIL: contact address is present in the upwork bundle." >&2
  exit 1
fi
if ! grep -rq 'khalidahammeduzzal' "$DEPLOY/web/assets"; then
  echo "FAIL: contact address is missing from the normal bundle." >&2
  exit 1
fi

echo
echo "web    $(du -sh "$DEPLOY/web" | cut -f1)"
echo "upwork $(du -sh "$DEPLOY/upwork" | cut -f1)"
echo
echo "Next: git add deploy && git commit && git push"
echo "Then: cPanel -> Git Version Control -> Update from Remote -> Deploy HEAD Commit"
