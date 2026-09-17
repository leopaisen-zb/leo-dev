# V2 specification and plan review — no confirmed scope violations

This is a read-only pre-activation review. It is not a v2 activation receipt and does not authorize use of v2 for an implementation or final acceptance claim.

## Bound sources

| Source | SHA-256 |
| --- | --- |
| `AGENTS.md` | `6653c8c525bf2efe0f9473de0ad1a9064967be9964b29ff9b29b2a46e2acf69a` |
| `docs/spec-v2.md` | `63d8e80779df469aad6ada4996a6330f7d923447c90c22e51c6db87f9ed659a3` |
| `docs/design.md` | `d029f9253c9899ab602fe696b0d48de8a06d2f820de5f2c9ae65e87eddff5a53` |
| `docs/method-binding.md` | `d4a28f623045888ff8934f191b29c95e1052a04142e69982eeebd10f4b6decb0` |
| `plan-v2.json` | `cb0797f32a6242699e2c365645ac5743e8bc1c7b0f414688755d4baea9e83cee` |
| `core/gates/default.yaml` | `12668092bd01ad04b93e1872bc09e30330b4f424c8e6a4f53be366600ddf51be` |

`docs/method-binding.md` keeps v1 as the active requirements source until public revise activation and explicitly says the v2 refinement requires revalidation of every task. `AGENTS.md` matches that rule by naming `spec-v2.md` only when activated. No `.specify/extensions.yml` file exists.

I also used the locally pinned upstream CC-SDD requirements-review, design-review, and task-generation rules, plus the Spec Kit analyze command, as read-only consistency criteria. I applied only their relevant checks because this project deliberately uses the bound Markdown/JSON artifacts rather than their template locations.

## Review result

No confirmed scope violations were found.

- The only behavioral v1-to-v2 requirements change is Requirement 3.3: case-insensitive search matches title **or notes**, with an empty query matching all. `plan-v2.json` advances every M1–M5 task to revision 2, and M3 explicitly requires a notes-only case-insensitive browser case.
- M1 starts `ready`; M2–M5 are pending behind their declared dependencies. This forces fresh routed work and evidence rather than reusing v1 completion.
- The M3 syntax gate remains limited to `node --check`, while both spec and plan independently require a candidate-bound, platform-labelled real-browser report with screenshots and create/edit/status/delete, Escape/focus restore, combined filters, injection safety, error recovery, 390px overflow, and the v2 notes-only match. The syntax gate cannot satisfy M3 by itself.
- Requirement 4 retains the maximum 500-task import limit, exact fields, duplicate-ID and timestamp ordering rejection, atomic state/disk preservation, and the planned independent 415/413/foreign-Origin checks.
- M5 remains verification-only: its allowed path is runtime evidence, it depends on M1–M4, and its acceptance requires a complete API suite, a separate browser review, restart and source review, and an independent whole-change review. The plan therefore keeps implementation and final verification as distinct responsibilities.

The next required evidence is the actual post-public-revise design review context and revision activation record. This review does not substitute for it.

## Post-activation binding check — PASS

Checked the raw controller state in `mochi-v2-design-pending.json` after public revise. It is in `design-review`, with authority revision 2 and revision/spec identifier `13776dfb6f2167649877847d4852fc2f0b6d3abd53cfd875da86fd5f8c0675d4`. Its source binding is `docs/spec-v2.md` with SHA-256 `63d8e80779df469aad6ada4996a6330f7d923447c90c22e51c6db87f9ed659a3`; its constitution binding is `AGENTS.md` with SHA-256 `6653c8c525bf2efe0f9473de0ad1a9064967be9964b29ff9b29b2a46e2acf69a`.

The supplied design-review context binds `docs/design.md`, producer `/root`, design hash `d029f9253c9899ab602fe696b0d48de8a06d2f820de5f2c9ae65e87eddff5a53`, and controller plan hash `dfe9f88228c345e4bc5cd50f5559fbbd3ef8fc75056e5788b7718a8b5d5db066`. Decoding its embedded design source produced byte-for-byte equality with the reviewed `docs/design.md` and the same SHA-256. The context routes are structurally equal to the five tasks in `plan-v2.json`; all are revision 2. `plan-v2.json`'s raw file SHA-256 is `cb0797f32a6242699e2c365645ac5743e8bc1c7b0f414688755d4baea9e83cee`, distinct from the controller's plan fingerprint.

The state preserves one consumed failure for M1 and one for M2, as required. No binding mismatch or scope violation was found. Fresh M1/M2 candidate-bound verification remains required under this new authority.
