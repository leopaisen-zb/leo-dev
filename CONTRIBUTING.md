# Development guide

Leo Dev is a private, UNLICENSED project. Coordinate substantial changes with the repository owner and keep the existing specification authoritative. Preserve unrelated edits and historical evidence; do not reset a working tree to make a check pass.

## Local checks

Use Node.js 20 or newer and npm:

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run build:adapters
npm run verify:packages
npm run build:marketplace
```

The full controller suite runs process and recovery test files serially and can take tens of minutes on a laptop. Keep the machine awake while running tests that exercise real lease expiry. During development, build once and run the relevant public-command tests:

```sh
./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-plan.test.ts
```

Run the example's HTTP acceptance separately:

```sh
cd examples/mochi-board
node --test tests/*.test.mjs
```

Use actual browser interaction for UI changes. A screenshot alone does not validate persistence or error recovery.

## Change boundaries

Runtime source lives in `packages/cli/src`; schemas in `schemas`; portable instructions in `skills/develop`. Adapter and runtime packaging are in `scripts`. Keep one controller/journal owner. New commands must use existing projection, lock, candidate and recovery checks rather than create another completion store.

Risk, spec/task revisions, candidate hashes, review provenance and unknown effects are behavior contracts. Exercise them at the public CLI seam. Test refusals for unchanged source/state, then test the authorized positive path. Keep failed experiment results and label missing evidence; do not weaken an acceptance rule to obtain green output.

Selected upstream method resources are pinned originals. Update them through their provenance inventory and preserve licenses. Do not edit vendored wording as an incidental cleanup.

## Pull request information

Explain the concrete behavior change, why it is needed, actual validation and remaining limits. Include the applicable requirement or issue reference. Do not add raw agent transcripts, credentials, personal paths, runtime journals or local approval receipts to Git.

The repository's CI checks source and package integrity. Deployment, publication and destructive changes require the owner's task-specific authorization.
