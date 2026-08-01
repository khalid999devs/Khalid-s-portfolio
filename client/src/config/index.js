// Build-time switch, set by scripts/build-deploy.sh. Vite inlines VITE_* and
// rolldown folds the constant, so the unused branch is dropped from the bundle
// rather than merely hidden -- the contact address is absent from the upwork
// build's JS, not just unrendered. build-deploy.sh checks that every time.
//
// Unset means false, so `npm run dev` and a plain `npm run build` behave
// exactly as they did when this was a literal.
export const isUpwork = import.meta.env.VITE_IS_UPWORK === 'true';
