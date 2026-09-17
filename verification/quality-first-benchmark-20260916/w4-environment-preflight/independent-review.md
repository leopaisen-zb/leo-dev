# Independent review: W4 ELI5 isolation adapter

**Verdict: PASS for freezing the adapter and using it on fresh, originally guarded W4 attempts.** I found no blocking defect in the reviewed helper, tests, retained zero-model preflight, or first prepared derived artifact. This approval is bound to the hashes below and covers only the narrow addition of one disabled `/Users/leo/.codex/skills/eli5/SKILL.md` entry on top of the accepted humanizer supplement.

## Reviewed boundary and hashes

- `experiments/quality-first-benchmark/eli5_isolation_supplement.py`: `064a187499dec721fd397db342fd9e0329e4b1fcdf08af40213baee1250786b3`
- `experiments/quality-first-benchmark/test_eli5_isolation_supplement.py`: `6f6dd3aeb0c87bad44aba5fd8fec44edfa4aa46897a5663d094c85297f7caf58`
- accepted base-helper lock: `038463ae7c4925753d29e1ba5abc66a8ffb42bff4406921700bb8fa7fc9cf912`
- retained preflight-evidence lock: `9985fa031de8958055c9a7e227e9eb187e457fb7336ca9a04c8ddf931fbc82e8`
- W4 preparation freeze: `b64dd6f0624ca034b1176fc3786747c541fa06cb1bbc28b48e54f9f91b0e8750`
- 22-entry base-supplement record: `310be66996de650e1ffb03bf50c3c52ad802ac550a2246e35bea8d57da1432b8`
- first accepted base lock, `w4-01-1-hold-r1-new-leo`: `b52c7ebbc040ec6a92f1bd54f0f1ae297bcc11ca0736df312d22d6cecbf25b38`
- first derived ELI5 lock: `d2b3360e110db076836a82d6282883edb3b5308433217fd558690b4c018482a6`
- first base/derived config: `f86cf3174527f90ba8089cdc90c49023174d7ac44d98093b5a9e623749615513` / `1ea811c56a3738c4c6fb9154cf66a322a747c60fa53bf9b58ecba578a023b0bd`
- first base/derived argv: `f8b89163ce124c34dc03d576df73b138a6f19bc271b3d7ff686c64c5418e042c` / `d5e19740736dd316390635d96303698dcce6cfff462db162abc5f156e81fdc02`
- first attempt stage record, binding the 1,326-file staged candidate: `376dbb82ddc6bef3d6309eacfc40e2fc375a24e756c986ac68898a7b3bbe86c6`
- derived-discovery operation: `11e69eb10c8757faf94b0b517cdce64d78bb7b541aa8ac60856cf28053617dfa`
- derived-discovery manifest: `f5d9a0c44f613dbb55e4049079bea37e8a44871f5cf6901c3fa6bf664a1618c8`
- derived-discovery event stream: `ff28bb3ac308846be21c962065835ff6365788a0712ea878745786dcc4f07559`
- derived-discovery raw skill list: `e566963e0e81b70d367ccec575991a860d8c30ccf4d554525c1e445114f0efa7`

The base-helper lock resolves to the accepted helper, test, and review hashes embedded in the new helper. The 22-entry base record resolves to the same W4 freeze and reports `actualModelRuns: 0`.

## Isolation and preservation checks

Preparation and verification both delegate first to `isolation_supplement.verify_supplement`. That inherited guard re-runs the original W4 verification and rechecks the freeze, original input hashes, original config and runner argv, accepted helper/test assets, prior humanizer evidence, and absence of the trial output. The ELI5 wrapper then rechecks the accepted-helper lock and its own helper/test hashes. Launch calls the same complete verifier before returning or executing an argv.

The derived config is a deep copy of the accepted humanizer-supplement config. In the actual first artifact, the only changed top-level key is `skills.config`; its original 109 entries remain an exact prefix and the sole appended entry is:

```json
{"path": "/Users/leo/.codex/skills/eli5/SKILL.md", "enabled": false}
```

The wrapper rejects ELI5 if it is already assigned or configured. It does not alter or read the ELI5 skill. In the actual first argv, length and every value are unchanged except index 9, the value immediately after the sole `--config-file` flag. The model, effort, prompt path, developer instructions, skill-input path, control path, timeout, allowlist, watched source, runner, cwd, and output path therefore remain those returned by the accepted base verifier. The first trial output did not exist at review time.

The verifier reconstructs both the expected derived config and exact expected argv rather than trusting stored hashes alone. The focused tests include a derived-argv mutation whose stored byte and canonical hashes are recomputed; verification still rejects it because it differs from the base argv outside the config value. A separate test confirms that a refusal from the inherited base verifier is propagated.

## Zero-model preflight evidence

The retained diagnostic config equals the W4 freeze's laboratory native config at SHA-256 `bd14b412ce68b4d58dc2a9cf36100c6b6e652e51f2902eda936ba99148a6901f`, plus the accepted disabled-humanizer entry and the four recorded sandbox fields. It is not compared to a trial-specific config. The native and diagnostic configs contain no ELI5 entry, so this preflight observes the environment condition that the new adapter addresses.

The frozen manifest records `executionOutcome: ISOLATION_FAILED`, `environmentStatus: skills-isolation-failed`, initialization and skills listing complete, and exactly one unexpected enabled skill: `eli5` at `/Users/leo/.codex/skills/eli5/SKILL.md`. It has no thread ID, terminal status or turn, active cleanup turn, agent lifecycle, token record, interruption, or intervention, and process-group cleanup is confirmed. The six-event stream contains only initialization and `skills/list` traffic; it contains no `thread/start` or `turn/start`. The evidence lock binds the operation, diagnostic config, manifest, and event stream, while the helper pins that evidence-lock hash.

The first actual derived discovery then passed with `executionOutcome: DISCOVERED`, initialization and skills listing complete, all 15 expected allowlisted consumer skills enabled, and no unexpected enabled skill or discovery error. Its manifest again has no thread ID, terminal status or turn, active cleanup turn, agent lifecycle, token record, interruption, or intervention; server and protocol errors are null and process-group cleanup is confirmed. Its six events are again limited to initialization and `skills/list` traffic.

The derived-discovery operation records the reviewed frozen argv hash `d5e19740736dd316390635d96303698dcce6cfff462db162abc5f156e81fdc02` and exited zero. I compared its argv directly with the frozen argv: the only in-place change is the `--out` value, redirected to the separate evidence directory, and the only appended item is `--discover-only`. The actual trial output remained absent and no model turn was started.

## Independent verification

I reran the focused suite and syntax check:

```text
python3 -m unittest -v experiments/quality-first-benchmark/test_eli5_isolation_supplement.py
Ran 7 tests in 0.078s
OK

python3 -m py_compile experiments/quality-first-benchmark/eli5_isolation_supplement.py experiments/quality-first-benchmark/test_eli5_isolation_supplement.py
```

I then ran both the accepted base verifier and the new verifier in verify-only mode against the first actual artifact; both returned `VERIFIED_NOT_LAUNCHED`. I also checked the successful derived-discovery manifest, event stream, assigned-skill count, cleanup, and exact diagnostic argv delta. No `--execute` invocation was made.

## Limits

This review establishes the fail-closed adapter contract, the retained environmental observation, the exact first prepared artifact, and its successful zero-model discovery. It does not claim that a model run occurred, that the remaining 21 derived artifacts already exist, or that later trial outputs, scoring, quality, latency, or cost are valid. Each later artifact must still be freshly generated from its recorded base, pass this verifier, retain an absent trial output at launch, and be externally hash-recorded. Any change to a hash listed above requires new review or an explicit updated lock.

I did not read held prompts or requirements, inspect skill contents, launch a model, alter frozen inputs, modify global configuration, or change scoring and acceptance thresholds. The adapter handles only the exact ELI5 path observed in this preflight; it is not evidence that no future environment drift or additional global skill can occur. The unchanged runner allowlist remains responsible for refusing any such extra skill before a model turn.
