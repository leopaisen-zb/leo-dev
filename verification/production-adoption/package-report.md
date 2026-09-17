# P1 — packaged upstream resource closure report

## Scope and boundary

This report covers the package-worker-owned closure: the adapter build inventory,
upstream-resource integrity validator, adapter tests, and the 17 pinned cc-sdd /
Spec Kit resource copies plus their production provenance. `references/upstream-methods.md`,
components/NOTICE, workflow instructions, and controller/CLI work are owned by other
workers and are not claimed here. No Git, network, install, cache/global-state, or
historical-experiment files were changed.

The review baseline supplied for this production round is
`/private/tmp/leo-dev-production-before.Y5JjLF`; the repository has no usable HEAD,
so this report makes no Git-diff claim.

## TDD evidence

### RED — upstream resources were absent from clean packages

Before resource/build changes, this command exited 1:

```sh
node --test --test-name-pattern='relocates declared upstream resources' tests/adapters/walking-skeleton.test.mjs
```

The clean Codex package lacked
`skills/develop/references/upstream/provenance.json` (`ENOENT`). The test built the
package first, so this was a relocation/package failure rather than a source-tree
existence check.

### RED — nested upstream entries created additional discovery sentinels

Before the packaging-only filename mapping, this command exited 1:

```sh
node --test --test-name-pattern='^ships exactly one discoverable SKILL.md sentinel per portable package$' tests/adapters/walking-skeleton.test.mjs
```

The recursive result contained `develop/SKILL.md` plus the three cc-sdd upstream
`SKILL.md` entries. The production package now keeps their source paths in
provenance but maps their package filenames to `RESOURCE.md`; bytes and hashes are
unchanged.

## GREEN evidence

The following focused package checks passed after implementation:

```sh
node --test --test-name-pattern='^(ships exactly one discoverable SKILL.md sentinel per portable package|relocates declared upstream resources with every portable package|rejects tampered upstream bytes and invalid provenance paths on temporary source copies|verify refuses tampered packaged upstream resources)$' tests/adapters/walking-skeleton.test.mjs
```

Result: **4 passed, 0 failed**. These checks build all four portable packages;
verify the exact production manifest, 17 resource hashes and both license files;
reject source-copy byte/provenance-path tampering; reject packaged-resource
tampering; reject experimental package material through the strict portable
inventory; and require exactly one recursive `SKILL.md` sentinel.

Additional direct integrity check passed:

```sh
node --input-type=module <<'NODE'
import { validateUpstreamResources, upstreamResources } from './scripts/upstream-resources.mjs';
await validateUpstreamResources('skills/develop');
console.log(`validated ${upstreamResources.length} pinned upstream resources`);
NODE
```

Result: `validated 17 pinned upstream resources`.

Syntax checks for `scripts/upstream-resources.mjs` and
`scripts/build-adapters.mjs` passed. Earlier focused existing-adapter checks for
output traversal, source symlinks/unknown files, YAML metadata, and Codex-only
material also passed (3 passed, 0 failed).

The coordinator's final full test run reported **161 core and 17 adapter tests
passed**. Its parallel CLI partition also reported several unchanged 5000 ms
timeouts; no timeout, acceptance, or implementation change was made here.

## Changed files

- `scripts/build-adapters.mjs` — adds the host-owned upstream-method reference
  and the explicit pinned resource inventory to `portableFiles`; invokes upstream
  resource validation while preserving the existing portable-files verification
  engine.
- `scripts/upstream-resources.mjs` — new fixed 17-entry inventory, production
  manifest constructor, strict manifest/path/duplicate/transformation/hash checks,
  and symlink refusal.
- `tests/adapters/walking-skeleton.test.mjs` — relocation, byte/hash, source and
  packaged tamper, invalid-provenance, and single-sentinel coverage.
- `skills/develop/references/upstream/provenance.json` — schema version 1,
  production-only scope, source and packaged hashes, pinned revisions, and the
  three `SKILL.md` to `RESOURCE.md` package mappings.
- `skills/develop/references/upstream/cc-sdd/**` — 15 original pinned cc-sdd
  resources, including its license; the three original `SKILL.md` resources ship
  as byte-identical `RESOURCE.md` files to preserve the sole public sentinel.
- `skills/develop/references/upstream/spec-kit/**` — original pinned `analyze.md`
  and license.

## Remaining concerns / handoff

- The single-sentinel result is a deterministic packaged-artifact contract. It
  does **not** claim a reproduced loader defect or installed-client discovery
  verification; fresh-client installation remains separately authorized and
  untested.
- The only allowed transformed item is the already-disclosed
  `design-discovery-light.md` final-newline normalization. Its package hash is
  checked, and hashing the packaged bytes without that final newline matches the
  pinned original source hash.
- The build and validator contain no `experiments/reuse-first` or `trialPath`
  runtime/build dependency after this one-time mechanical copy.

## Fix round 1 — semantic provenance ordering (review finding)

Independent review found that the first validator compared the complete `sources`
array with `JSON.stringify`. That accidentally made JSON object-key order and the
order of otherwise independent source records part of the contract.

### RED

This temporary-copy test failed before the fix with `Upstream provenance manifest
does not match pinned inventory`:

```sh
node --test --test-name-pattern='^accepts semantically identical upstream provenance despite source key and list ordering$' tests/adapters/walking-skeleton.test.mjs
```

The fixture reverses the source list and writes every resource object with the
same required fields in a different order; it changes no value or resource byte.

### GREEN

The helper now validates the source list as an unordered set keyed by unique
`packagedPath`. Each entry must have exactly the seven declared fields and match
the pinned repository, revision, source path/hash, transformation, packaged path,
and packaged hash. Unknown, duplicate, missing, malformed/escaping, and
pin-mismatched records remain rejected.

```sh
node --test --test-name-pattern='^(accepts semantically identical upstream provenance despite source key and list ordering|rejects tampered upstream bytes and invalid provenance paths on temporary source copies|relocates declared upstream resources with every portable package|verify refuses tampered packaged upstream resources|ships exactly one discoverable SKILL.md sentinel per portable package)$' tests/adapters/walking-skeleton.test.mjs
node --check scripts/upstream-resources.mjs
```

Result: **5 passed, 0 failed**; syntax check passed. The coordinator will run the
scheduled broader suite separately, so this round makes no new full-suite claim.
