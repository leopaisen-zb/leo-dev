# Independent review: W4 index-1 progression proposal

## Verdict

Accept the proposal as a narrow sequencing exception. The locked zero-model
preflight satisfies its resume-environment gate. This review is not launch
authority; schedule index 2 still requires a separate root authorization that
binds the proposal, this review, and the preflight evidence.

The proposal preserves the substantive controls that matter: index 1 consumes
its only fixed opportunity; remains `UNKNOWN`, `server-error`, historically
active at cleanup, unscored, unaccepted, and product-unverified; receives no
rerun, replacement, rescue, or fabricated score; and supplies no favorable
evidence for either Leo cohort. Current owned-process absence is used only for
safe schedule progression. It does not rewrite the terminal manifest or make
index 1 score-eligible.

Proposal SHA-256:
`ce536bd505a976a6272e5f8f32862c3eaac5e9872dc8ad0a91235535312d254c`.

## One required clarification for final authorization

The proposal says to record the observed client version. Recording a changed
version is insufficient because the frozen common execution contract specifies
Codex CLI 0.154.0. The final root authorization must require the actual
preflight/launch path to report 0.154.0. A different version would make the
remaining run an unmatched environment and would stop continuation as the
fixed W4 experiment; it could only be reported separately, not silently folded
into the fixed comparison.

The locked preflight reports `codex-cli 0.154.0`, so this condition is met for
the resume gate. The final authorization should preserve it for the actual
launch path.

## Deterministic checks

- The proposal's four evidence hashes match the current files: readiness
  `be9e1c6d0269bfc2e36539e8f57295a707d755c45710f2eb28a0049ca0712eac`,
  index-1 review
  `dd2be9466eb5f8e3f35c0224d363d2aa4810f96c743e7f97154a94f41d8866b5`,
  cleanup attestation
  `6336f7695cea308a37bcd949bc369c00598d0d1ea4ddceec7c8c75a8f7ecc0b3`,
  and sleep evidence
  `fedbe955e4e77731b5f52bd9b6a5cd41e58f6b260d73c2d0f6897fa758bdc20d`.
- The retained index-1 manifest and events remain
  `03ea2c570c55bc37cd48504d4730272db965c538d26cec8ddc759b5ece7956c0`
  and
  `8eada6235fbf44d38de306fc0f00578d13c4e9985d79db6aa51da751f2f5ba15`.
  Its trial directory contains no score file. The independent `pgrep` probe
  found no process in owned group 82615, while the historical primary turn
  remains in `activeTurnsAtCleanup`.
- The aggregate has 22 scheduled entries, 2 started, 0 scored, and 20 pending.
  Its attempt order matches the frozen schedule. The schedule and freeze hashes
  remain
  `c86c3471c53f631ecd1b55ff0b86e5094e66481963be8f0e61209f0319d5e31c`
  and
  `b64dd6f0624ca034b1176fc3786747c541fa06cb1bbc28b48e54f9f91b0e8750`.
  The index-2 trial path does not exist at review time.
- The zero-model discovery evidence lock is
  `c32b06b17f5c173d7b23b7ec9d982355fcada8194672b07197f319dc9053ac9d`;
  its operation record is
  `1c9900752cc0ec83248ced88c31fdf92024cce5db311f07f541944771a150121`.
  It records exit 0, `VERIFIED_NOT_LAUNCHED`, all readiness pins matched,
  exactly 15 expected enabled skills at their assigned paths, no extras or
  discovery errors, no thread, turn, model work, or token usage, process group
  97200 confirmed gone, CLI 0.154.0, and no actual index-2 trial directory.
- Index 1 used 3,624 seconds against the fixed 1,800-second wall budget. The
  raw terminal record remains `server-error`, not `timeout`: after the host
  sleep interval, the server emitted a retryable TLS reconnect error and the
  frozen runner stopped on every server error. No source implementation was
  made. This is a wall-budget environment/process failure, not a product
  result.

## Sleep-record correction

The immutable index-1 review labels the 13:21:14Z event as a clamshell
`DarkWake`. The frozen power evidence records it as `Sleep`; 13:21:44Z is also
`Sleep`, followed by intermittent DarkWake events and the 14:19:49Z full wake.
This label correction does not change the disposition. The power record shows
that sleep overlaps the event gap; it does not by itself prove the origin of
the later TLS fault.

## Overnight break and global instructions

The overnight resumption weakens temporal comparability but is not, by itself,
a protocol reason to discard the remaining fixed opportunities. The protocol
sets no maximum gap between schedule entries. The proposal correctly requires
the final report to disclose a new host execution window and to stop claiming
that all 22 attempts ran in one uninterrupted window. Local configuration,
runtime, discovery, package, input, and permission drift would be a hard stop;
provider-side execution identity and any service deployment drift remain
unverified limitations even if the local preflight passes.

The current global `/Users/leo/.codex/AGENTS.md` has SHA-256
`f6d34467fe116814404b674b55146f0f20f748c07f544297ab9e4f76e59503f5`
and filesystem modification time `2026-09-16T16:37:09+0800`, before index 0
started at 21:02 local time. That ordinary filesystem evidence supports that
the current bytes predated both completed attempts and were not introduced by
the overnight pause. The manifests record only the instruction-source path,
not its content hash, so exact byte equality at the two prior thread starts is
not cryptographically attested. The current hash and time should therefore be
bound as resume-environment evidence, not described as a previously frozen
actor-input hash.

The global instructions contain development and model-routing preferences, but
the frozen common developer instructions explicitly restrict each actor to its
assigned benchmark method. This residual global instruction exposure was
already contemplated by the frozen protocol. It remains a process-review item:
later traces must be checked for cross-arm method use. It is not evidence that
either index 0 or index 1 consumed another arm's method.

## Comparison consequence and next controlled action

HOLD-R1 pair 1 has two unscored, product-unverified outcomes caused by different
process/environment failures. It cannot support an old/new quality ranking.
The remaining attempts may still produce case-specific paired observations,
but the final report cannot claim a complete three-valid-pair HOLD-R1
comparison or infer quality from this failed pair. No rule requires every pair
to pass, and this review adds no acceptance threshold.

The smallest next action is a separate hashed root record authorizing the one
original index-2 opportunity and binding the proposal, this review, and the
locked preflight. The actual launch must reapply the frozen guards. If they no
longer match, or another actual trial ends with an environment stop or
historical active turn, the experiment stops again for explicit disposition
rather than gaining another automatic exception.

No held-out requirement, oracle, reference solution, candidate source, scorer,
threshold, helper, package, or pinned record was inspected or changed for this
review. No evidence supports a model, reasoning-effort, RAG, or multi-agent
routing change.
