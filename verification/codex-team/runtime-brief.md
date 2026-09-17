# C3.2 Codex runtime packaging brief

User approved local Codex team implementation and research-plan execution, not installing/global changes. Deliver a relocatable **built Codex package** with an explicit runnable CLI, so its reference no longer depends on a developer checkout or temporary research directory. No installed-host readiness claim.

## Ownership

Own `scripts/build-adapters.mjs`, `scripts/verify-packages.mjs`, new `scripts/package-runtime.mjs`, and `tests/adapters/codex-runtime.test.mjs`. Report in `verification/codex-team/runtime-report.md`. You are not alone: another worker owns CLI/controller/team/tests; main owns skill/reference files and edits existing adapter test inventory. Preserve others' edits, no subagents. No Git changes, install/download/dependencies, global config, external writes or cleanup of non-owned files. Use apply_patch and snapshot your existing owned files for an actual before/after diff.

Main is adding portable `references/codex-team.md` plus `references/upstream/bmad-team-LICENSE.txt`; add these two exact files to portableFiles (main updates existing tests accordingly). Main will not edit your scripts. Add runtime only to Codex package, not three-host claims. Non-Codex thin packages remain otherwise unchanged.

## Architecture / contract

Keep current manifest schema and strict unknown-file/symlink checks. Add owned `runtime/` inside built Codex package with CLI at `runtime/packages/cli/dist/index.js`. Retain the same package-relative source tree layout needed by moduleRepositoryRoot/launcher/schema resolution. Include only actual runtime assets (compiled CLI files, schemas/core as actually consumed, package metadata) and the installed runtime dependency closure required by packages/cli/package.json. Existing node_modules are build inputs, not a new npm install. Copy their licenses/package files; refuse missing, unsafe or conflicting resolution rather than traversing arbitrary symlinks. Do NOT copy development project secrets, history, evidence, tests or all project node_modules.

Use existing Node platform APIs and package-lock.json/node resolution for closure; no new bundler or dependency. Reusing node_modules packages does not authorize editing them. A runtime identity file `runtime/runtime-manifest.json` records schemaVersion, Node prerequisite >=20, CLI entry, package/source digest and exact included-file sha256 inventory (excluding itself). Deterministic builds on same source should agree. Validate manifest against trusted current build inputs and package inventory; do not trust a tampered manifest to bless tampered files. Packaged CLI reports team help normally once C3.1 merges. Running it with an explicit Node path is the supported launcher; do not globally register a command or silently install Node.

No auto source rebuild from imported build() that would race CLI worker: require current compiled files; main runs npm run build before final packaging. State clearly if production-source to compiled-output freshness cannot be proven by this step; main will do final build before packaging. For runtime copying use staged owned package paths already validated by existing builder; symlink sources/ancestors refused. Preserve existing output replacement protections.

## RED/GREEN tests

Write real node:test cases first, run before production edits and record RED. Use mkdtemp owned directories. Highest seam: build Codex package, copy/move it to another isolated parent without a project node_modules ancestor, run CLI with cwd an unrelated minimal project and explicit Node executable. `init --spec spec.md`, `status` must work there without source-checkout runtime/dependency resolution. Once team merges, `team --action status` and a minimal valid open/status across fresh processes must work too; do not mock executable. This proves relocatable package execution, not Codex installed loading or actual LLM team behavior.

Also test package verification rejects runtime source/file/manifest tampering, unexpected files and escaping symlinks; build refuses missing runtime prerequisite rather than shipping broken package. Preserve existing portable-skill/adapters tests. Keep 32 KiB transcript policy etc in team worker; no modifications to team logic. Commands: `npm run build`, `node --test tests/adapters/codex-runtime.test.mjs`; after GREEN `node --test tests/adapters/*.test.mjs`. Main runs final whole suite and built plugin validator.
