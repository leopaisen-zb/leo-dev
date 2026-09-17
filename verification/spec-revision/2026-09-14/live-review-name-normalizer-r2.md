# Independent candidate review — `name-normalizer` revision 2

**Verdict: PASS**

**Reviewer:** `/root/p3_review_fallback`  
**Review subject:** change `p3-live-retry1`, task `name-normalizer`, V2 revision 2  
**Fixture:** `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog`

## Findings

- Critical: none.
- Important: none.
- Minor: none.

## Spec compliance

`requirements-v2.md` and the revision-2 task require the normalizer to remove boundary whitespace while preserving Unicode characters and internal double spaces. `src/name.mjs` implements `String(value).trim()`. For the specified string inputs, this removes only the leading and trailing ECMAScript whitespace/code-point set; it neither normalizes Unicode text nor collapses, removes, or rewrites internal characters. A whitespace-only value becomes the empty string, and the default for an omitted value is also the empty string.

`acceptance/name.test.mjs` exercises the required behavior directly:

- `"  Ada  Lovelace  "` becomes `"Ada  Lovelace"`, proving boundary trimming and preservation of an internal double space.
- `"  李  雷  "` becomes `"李  雷"`, proving preservation of Unicode characters and an internal double space.
- A spaces-only input becomes the empty string.

The implementation is a single deterministic expression with no state, I/O, locale dependence, or mutation. I found no error path within the task's specified string-input contract. The unchanged source and acceptance test also comply with `local-constitution-v2.md`, which requires preserving the frozen application and acceptance tests during revalidation.

## Independently verified bindings

I recomputed the relevant canonical bindings from the fixture rather than relying on the handoff values:

- `runId`: `run-0e0af055-82f4-490b-af8d-f167ea81dafb`
- `taskId`: `name-normalizer`
- `taskRevision`: `2`
- `leaseGeneration`: `2`
- V2 `specHash` / semantic authority fingerprint: `1839af19ab92171193605656a767395403be735ac64b85ab3c6f7b3f68a3d1a3`
- revision-2 `taskHash`: `4d05124756aa691a21974def3526a06e73856d1e79f872ef57b434222b417789`
- canonical 18-entry candidate `treeHash`: `6045d1e71e043765f08194c9d7eee6e36859103783d529debd84af1a3a33fb5c`
- `name-normalizer-gate` definition hash: `a1b7baeab7d23899faf8e9657ef4864d8b4d1fcba21ecda5ab5bb3a98c7f4e0e`
- `requirements-v2.md`: `d50c187e2b027cd34cdd4bd960bbc38ee13fbcc69f22846508c8726ca000dc7a`
- `plan-v2.json`: `7c31f5c2014045fb51bd87d133eb1d3c8952c1acdaa886f56d3ae2dae8591eea`
- `local-constitution-v2.md`: `85c3f53f50cd4277de962bf9af7a722cef83ca88e7cd66df4bb4d14c9440b956`
- immutable revision record: `06dbaf717e406314b5192b5200ac3c09c56e9604180d869fd2e9001c348e7a73`
- `src/name.mjs`: `ead2a9cf6268362141c623856dda2db77a665feb162bdabadbf2ee20c828c845`
- `acceptance/name.test.mjs`: `96ee46c60dd8b9780d9f2c0ddd6b13acc296d223994697a803461224cb33c158`
- candidate context JSON: `ebfd5361a3c14647cf58103a453dcfd47a5ee2e4192700d5aef55e0023427caa`

The semantic authority recomputation used revision 2, the V2 spec source and hash, the V2 constitution and hash, and both revision-2 task routes. The task hash recomputation used the `name-normalizer` revision-2 plan entry. The tree recomputation used the claim's canonical 18 entries and reproduced the candidate and Gate tree exactly; its `src/name.mjs` and `acceptance/name.test.mjs` entries have mode `0644` and the hashes above.

## Fresh revision-2 Run and Gate evidence

This is a new revision-2 evidence chain, not reused revision-1 completion evidence:

- The Run is `run-0e0af055-82f4-490b-af8d-f167ea81dafb`, distinct from the revision-1 `name-normalizer` Run `run-e1d9b458-475f-4587-a27b-78547fcf8ec7`.
- Claim, candidate registration, Gate attempt, Gate result, and submit events all carry task revision 2 and lease generation 2.
- The new Gate attempt is `c7f5cd3adc610ff03fda4b16a8b52a2a6569451d42c3730fbf92d392268d4cc9`, bound to the new Run and tree.
- The candidate's current `evidenceRefs` contains only the new revision-2 Gate path. Older revision-1 paths appear only under `historicalEvidence`.

The Gate evidence file has SHA-256 `7f24499af1e00accf081d57a68e0020292562f546b286711e29b3121da3e6062` and evidence ID `e24d6f0011e74332ca3f2252e953fcbcd8ccc7ea94b17937e416d7cb6287d67a`. It records exit code 0 and `runStatus: succeeded`; its stdout reports 1 test passed and 0 failed, and its stderr log is empty. `inputTreeHash` equals final `treeHash`, and `inputWriteSurfaceHash` equals `writeSurfaceHash` (`3a406c25f3b251302356ae139439269f9dddd538219744d1d0f89e95bbeebae3`), so the Gate did not change its declared write surface.

I independently validated the journal hash chain through sequence 76, whose tail at the reviewed handoff was `c0880dcb34f0b7489426d408ece3d93a698b18fdbe6c0dc40c696a46e8a55e05`. Sequences 65–76 bind the revision-2 claim, candidate registration, prepared/started/released/settled Gate attempt, Gate result, and submit to the same Run, task revision, lease generation, task hash, authority hash, and tree hash. The Gate settlement's evidence content hash matches the independently hashed evidence file. The command journal likewise records the revision-2 claim, Gate, submit, status, and review handoff with these bindings.

## Scope and limits

This review covers only `name-normalizer` revision 2 in the named fixture, its V2 authority/task bindings, frozen candidate tree, current-version Gate evidence, and source/test compliance. It does not review or approve the revision-2 `cli-sample` task, the CLI wrapper contract, any installed package, overall P3/version completion, or controller correctness.

The acceptance test does not separately enumerate a literal empty-string input, tabs/newlines at boundaries, or every Unicode whitespace code point. Those are residual coverage limits rather than findings here because the implementation delegates the boundary operation directly to standard `String.prototype.trim`, and the frozen test covers the task's material Unicode and internal-double-space risks.

I did not invoke the controller, create or modify a receipt, rerun the Gate, or modify the fixture, source, tests, thresholds, or other reports. This report is an unauthenticated independent judgment for the root's review flow; it is not controller authority.
