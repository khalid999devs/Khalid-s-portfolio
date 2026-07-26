# Portfolio client

This is the React/Vite frontend for the portfolio. Repository-wide setup,
quality gates, production requirements, and security notes live in the
[root README](../README.md) and [security policy](../SECURITY.md).

Common client-only commands:

```bash
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run audit:dependencies
```

Production builds use same-origin `/api` and `/uploads` URLs by default. Set
`VITE_API_URL` only when the API is intentionally hosted on another HTTPS
origin.
