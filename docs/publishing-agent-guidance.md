# Repository guidance

Read the existing project specification and preserve unrelated changes. For new substantive work, clarify only material unresolved decisions, then record a plan in the project's existing location. Reviews and tiny fixes use proportionate checks.

## Commands

- Install: `npm ci`
- Compile: `npm run build`
- Types: `npm run typecheck`
- Controller and package tests: `npm test`
- Portable bundles: `npm run build:adapters && npm run verify:packages`
- Local marketplace: `npm run build:marketplace`
- Example: in `examples/mochi-board`, `node --test tests/*.test.mjs`

## Boundaries

One journal/controller owns task completion. Preserve risk classification, candidate/tree bindings, consumed receipt IDs, lease fencing and recovery no-clobber behavior. New lifecycle behavior needs public-command tests for refusal and success. Do not weaken tests or discard failed evidence.

Use separate implementer and reviewer sessions when available and appropriate. Give workers explicit file ownership; overlapping edits are serial. Record actual checks, including failed and unrun checks. Native, browser and AI-specific verification are not interchangeable.

No commit, push, installation, deployment, destructive cleanup or security/model setting changes are implied by a workflow skill. Obtain task-specific user authorization where needed. Never commit secrets, raw local histories, runtime journals or private approval receipts. See CONTRIBUTING.md, SECURITY.md and NOTICE.
