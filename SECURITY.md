# Security policy

Please report suspected vulnerabilities privately to the repository owner rather
than opening a public issue. Do not include real credentials, personal contact
records, or production database content in a report.

Only the current `main` branch is maintained. Security fixes should preserve the
repository's server and client quality gates.

## Temporary dependency exception

The client gate accepts
[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
only through 2026-12-31. The advisory concerns React Router Framework RSC action
handling. This application is a Vite single-page application and does not
install or run the React Router Framework/RSC server.

The audit script fails if another advisory appears, if a React Router Framework
runtime/configuration is added, or if the exception expires. Remove the
exception as soon as an upstream release outside the affected range is
available.
