# Independent candidate review — `cli-sample` revision 2

**Verdict: PASS**

**Reviewer:** `/root/p3_review_fallback`  
**Review subject:** change `p3-live-retry1`, task `cli-sample`, V2 revision 2  
**Fixture:** `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog`

## Findings

- Critical: none.
- Important: none.
- Minor: none.

## Spec compliance

`requirements-v2.md` and the revision-2 task require the public CLI to emit the normalized value followed by exactly one LF. An absent argument must emit exactly one LF, exit zero, and leave stderr empty. Unicode characters and internal double spaces must survive normalization.

`src/cli.mjs` reads the first public argument, substitutes the empty string only when that argument is absent, passes the value to `normalizeName`, and calls `process.stdout.write` once with the normalized value plus `\n`. This directly implements the requested output framing. It introduces no logging or stderr write and does not alter the normalized Unicode or internal spacing.

`acceptance/cli.test.mjs` launches the real CLI process and makes exact assertions for every required outcome:

- `"  Ada  Lovelace  "` produces exactly `"Ada  Lovelace\n"`, including the internal double space and one trailing LF.
- `"  李  雷  "` produces exactly `"李  雷\n"`, preserving Unicode characters and the internal double space.
- No argument produces exactly `"\n"`.
- Every invocation must have status 0 and exactly empty stderr.

The exact stdout comparisons would fail on a missing LF, an additional LF, collapsed internal spaces, changed Unicode, or any extra stdout. The process-level test also covers the actual argument and exit behavior rather than testing a mocked wrapper. The implementation is small, deterministic, and has no extra state or side effects beyond its specified stdout write. I found no error path within the specified invocation contract.

The frozen `src/cli.mjs` and `acceptance/cli.test.mjs` files are unchanged, as required by `local-constitution-v2.md`. The upstream `name-normalizer` dependency is in `done` state at revision 2 / generation 2 in this candidate, and the CLI Gate executes the imported normalizer through the public process path.

## Independently verified bindings

I recomputed the canonical bindings from the fixture rather than relying on the handoff values:

- `runId`: `run-6a73c8bf-e2a7-4ded-88ff-5658e3dfe8f9`
- `taskId`: `cli-sample`
- `taskRevision`: `2`
- `leaseGeneration`: `2`
- V2 `specHash` / semantic authority fingerprint: `1839af19ab92171193605656a767395403be735ac64b85ab3c6f7b3f68a3d1a3`
- revision-2 `taskHash`: `ab2384f7c6998932b8d0dbfba81457aece65402f53ea4584f891ce797481d70c`
- canonical 18-entry candidate `treeHash`: `6045d1e71e043765f08194c9d7eee6e36859103783d529debd84af1a3a33fb5c`
- `cli-sample-gate` definition hash: `c8fd1abf061407c4786e57db9fef8fd22a084cb76f935ac11e3932702a83da65`
- `requirements-v2.md`: `d50c187e2b027cd34cdd4bd960bbc38ee13fbcc69f22846508c8726ca000dc7a`
- `plan-v2.json`: `7c31f5c2014045fb51bd87d133eb1d3c8952c1acdaa886f56d3ae2dae8591eea`
- `local-constitution-v2.md`: `85c3f53f50cd4277de962bf9af7a722cef83ca88e7cd66df4bb4d14c9440b956`
- immutable revision record: `06dbaf717e406314b5192b5200ac3c09c56e9604180d869fd2e9001c348e7a73`
- `src/cli.mjs`: `ebb0b6416e22b105408cd8b6ea5b4584a045637a53ac46f90609ba59ce019b5e`
- `acceptance/cli.test.mjs`: `e8fe6d2e4003298242682283ad8452af57fa46b8079a19d0f9cc37511df3ee8b`
- candidate context JSON: `0fb21ea528aae0a557f21b6dcd60e2e53c80201680f786a749c2acda0aa5e39c`

The authority recomputation used revision 2, the previous V1 spec identity, the V2 spec source and hash, the V2 constitution and hash, and both revision-2 routes. The task-hash recomputation used the `cli-sample` revision-2 plan entry with runtime state excluded. The Gate-definition recomputation used the actual `cli-sample-gate` entry. An independent filesystem walk under canonical tree policy `v1` produced the same 18-entry tree and confirmed mode `0644` plus the hashes above for the CLI source and acceptance test.

## Fresh revision-2 Run and Gate evidence

This candidate uses a new revision-2 evidence chain:

- Run `run-6a73c8bf-e2a7-4ded-88ff-5658e3dfe8f9` is distinct from the revision-1 `cli-sample` Run `run-98fd6fb6-c03a-494a-a496-7d47042b654a`.
- The claim, candidate registration, Gate attempt, Gate result, and submit all bind task revision 2 and lease generation 2.
- Gate attempt `cf50489d53f830bf18505a62569b87ce3429eeec52c66716bf07d623723e0d51` binds the new Run, `cli-sample-gate`, the recomputed Gate-definition hash, and tree `6045d1e7…fb5c`.
- The candidate's current `evidenceRefs` consists of the revision-2 `name-normalizer` dependency Gate and this revision-2 CLI Gate. Revision-1 paths are confined to `historicalEvidence`.

The CLI Gate evidence has SHA-256 `9b3dfadc043ce9a82abb11cff8eca240d921ff7ea3703add25c60b6761b6374c` and evidence ID `f7c4c9f00cd71bb944fd75c7ecd3c573020d4eaede89206bda3f9a69dfbf9ae4`. It records exit code 0 and `runStatus: succeeded`; stdout reports 1 test passed and 0 failed, and the Gate stderr log is zero bytes. `inputTreeHash` equals final `treeHash`, and `inputWriteSurfaceHash` equals `writeSurfaceHash` (`e3d07476b815fc0885b07767573c8e83059ef5b476875c3c4097b0c9d1122bd8`), so the Gate did not change its declared write surface.

I independently validated all 92 journal frames present at the review handoff. The hash chain ends at sequence 92 with `724b084cb41f5689511ee95a42915670a1a52921a7641cd2bbf6870f6bb374aa`. Sequences 81–92 bind the revision-2 claim, candidate registration, prepared/started/released/settled Gate attempt, Gate result, and submit to the same Run, task revision, lease generation, authority hash, task hash, and tree hash. The Gate settlement's evidence content hash matches the independently hashed evidence file. The command journal records the same revision-2 Run in the successful claim, Gate, submit, status, and review-handoff entries.

## Scope and limits

This review covers only `cli-sample` revision 2 in the named fixture, its V2 authority/task bindings, frozen candidate tree, current-version dependency and CLI Gate evidence, and the stated CLI contract. It does not review installed-package identity, overall P3/version completion, controller correctness, or behavior for extra positional arguments and other cases outside the specification.

The acceptance test does not separately exercise a present-but-empty argument, tabs/newlines at the boundary, every Unicode whitespace code point, stdout backpressure, or a broken pipe. These are residual coverage limits rather than findings: V2 specifically requires the absent-argument case, the process-level assertions cover the material Unicode and internal-double-space risks, and the CLI delegates normalization to the revision-2 dependency.

I did not invoke the controller, create or modify a receipt, rerun the Gate, or modify the fixture, source, tests, thresholds, or other reports. This report is an unauthenticated independent judgment for the root's review flow; it is not controller authority.
