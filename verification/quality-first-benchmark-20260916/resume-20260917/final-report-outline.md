# Final quality-first benchmark report outline

This file defines report structure and evidence locations only. Final claims,
rankings, and recommendations remain unwritten until all 22 W4 attempt
dispositions are pinned.

## 1. Executive framing

- State the evaluated question and the decision the report informs.
- Separate four evidence waves: W1 baseline, W2 method selection, W3 board and
  regression acceptance, and W4 repeated held-out comparison.
- State the three independent dimensions used throughout:
  1. execution outcome: launched, terminal state, timeout, cleanup;
  2. product outcome: approved requirement conformance after independent review;
  3. process outcome: method use, protected-input preservation, review quality,
     resumption behavior, and delivery accuracy.
- Do not convert `UNKNOWN`, unscored, or process-failed attempts into product
  passes or failures.

Primary evidence:

- `resume-20260917/stable-results-sections.md`
- `w1-complete.json`
- `w2-current-dispositions.json`
- `w3-acceptance.md`
- `w4-current-results.json`
- `w4-independent-reviews/index-*.md`

## 2. Benchmark scope and comparison model

### 2.1 Six W1 configurations

Present the two approved cases for each configuration in one table, preserving
the original configuration names and product/process separation:

- Native Codex
- Superpowers
- cc-sdd
- Spec Kit
- BMAD
- Leo Dev

Columns to populate from pinned evidence: case, execution outcome, frozen score,
independent product disposition, retained process finding, latency/tokens where
available, and evidence link.

Evidence:

- `w1-development-results.md`
- `w1-independent-reviews.md`
- `w1-execution-metrics.json`
- `w1-conclusions.md`
- `independent-dev-f1-io-probes-6arms.json`

### 2.2 W4 repeated design

- Describe 22 fixed attempts over `HOLD-R1` and `HOLD-F1`.
- Explain the three paired old/new Leo comparisons for each case:
  `hold-r1-pair-1..3` and `hold-f1-pair-1..3`.
- List comparator arms by case: Native, Superpowers, full cc-sdd, full Spec Kit,
  and full BMAD according to the frozen schedule.
- Preserve array index order, pair IDs, and the two unscored index 0/1 process
  failures.
- Explain that pair comparison requires both members to have independent
  product dispositions; an unscored or unknown member cannot support a pairwise
  quality ranking.

Evidence:

- `w4-frozen-summary.json`
- `w4-readiness.json`
- `/private/tmp/leo-dev-w4-20260916/w4-schedule.json`
- `/private/tmp/leo-dev-w4-20260916/w4-freeze.json`
- `w4-evaluation-checklist.md`
- `resume-20260917/index-1-progression-proposal.json`
- `resume-20260917/index-1-progression-proposal-review.md`
- `resume-20260917/index-1-progression-authorization.json`

## 3. Exact tested and installed identities

### 3.1 Source and package identity

- Bind each wave to the tested source/package snapshot rather than a mutable
  current checkout.
- State the installed package identity used for W4 and distinguish new-Leo and
  old-Leo cohort packages.
- State each comparator's pinned staged distribution and allowed skill set.
- Report hashes exactly; do not infer provider identity from model self-report.

Evidence:

- `w4-final-package/identity.json`
- `old-package-identity.json`
- `w4-frozen-summary.json`
- `w4-final-package/delta-from-a.json`
- `w4-final-package/discovery-summary.json`
- `w4-base-supplements.json`
- `w4-eli5-supplements.json`
- per-attempt `*.stage.json`, manifest, isolation lock, and ELI5 lock

### 3.2 Runtime identity and attestation boundary

- Record requested model/effort, host-reported model metadata, CLI version,
  frozen prompt/config/developer hashes, and enabled skills per attempt.
- State that effective provider and child-model identities and monetary cost are
  not independently attested unless a later record supplies them.

Evidence:

- per-attempt `manifest.json`
- `w4-environment-preflight/derived-discovery-summary.json`
- `resume-20260917/w4-02-1-hold-f1-new-leo-discovery/evidence-lock.json`

## 4. W1 baseline results

- Reuse the stable W1 result table and supporting prose by reference; do not
  duplicate it while drafting.
- Add only the final report's cross-wave columns or definitions needed for later
  W4 comparison.
- Preserve automatic scores even when independent review found a false pass.

Evidence:

- `resume-20260917/stable-results-sections.md` — W1 section
- `w1-development-results.md`
- `w1-independent-reviews.md`
- `w1-conclusions.md`

## 5. W2 method-selection evidence

- Describe candidate A's same-change design-repair behavior and exact retained
  scope.
- Describe candidate B's closeout additions, actual consumption, review finding,
  incomplete accepted-candidate chain, and archive decision.
- Keep product dispositions distinct from method-retention decisions.
- Identify the exact selected source restored after W2.

Evidence:

- `resume-20260917/stable-results-sections.md` — W2 section
- `w2-selection.md`
- `w2-independent-reviews.md`
- `w2-current-dispositions.json`
- `w2-default-method-restoration.json`
- `w2-design-repair-package/identity.json`
- `w2-closeout-method-package/identity.json`

## 6. W3 product, regression, and board acceptance

### 6.1 Observation-path repair and independent acceptance

- Summarize the W3 correction, root/independent review, and final source
  comparison without restating all implementation history.

Evidence:

- `w3-acceptance.md`
- `w3-observation-lock-repair/implementation.md`
- `w3-observation-lock-repair/code-review.md`
- `w3-observation-lock-repair/final-regression/source-comparison.json`

### 6.2 Regression evidence

- Report passing applicable checks by category.
- Preserve the original full-command exit 1 and the exact evidence aggregation
  rule; do not claim a later full-suite exit 0 unless one exists.
- Separate default-environment restrictions from host-run acceptance.

Evidence:

- `w4-final-package/regression-acceptance.md`
- `w2-regression/coverage-final.json`
- `w3-regression/final-candidate-full.log.json`
- `w3-observation-lock-repair/final-regression/full.json`

### 6.3 Installed board evidence

- Report real headed-browser flows, responsive behavior, console/network
  observations, read-only consumer-tree checks, and installed-package checks.
- State the capture boundary: atime was not captured.
- Include corrected launcher evidence where the Node runtime changed observed
  behavior; distinguish product diagnosis from launcher/environment diagnosis.

Evidence:

- `w4-installed-board/REPORT.md`
- `w4-installed-board/consumer-before-after-ui-comparison.json`
- `w4-installed-board/consumer-final-comparison.json`
- `resume-20260917/board-index-2/CORRECTED_LAUNCHER_REPORT.md`
- `resume-20260917/board-index-2/corrected-launcher-evidence.json`

## 7. W4 execution results

- Provide a 22-row immutable attempt ledger in schedule order.
- Columns: index, attempt ID, case, arm/cohort, pair ID, start/end, elapsed,
  terminal state, cleanup state, interruption count, frozen score, product
  verdict, process verdict, and pinned review hash/path.
- Mark index 0 and 1 `UNKNOWN` / unscored / product unverified, with their
  process-failure reasons and progression exceptions.
- Keep runner/server failures, timeouts, score failures, protected-input
  mismatches, and independent product failures as separate fields.

Evidence:

- `w4-current-results.json`
- `resume-20260917/execution-notes.md`
- `w4-independent-reviews/index-0-process-failure.md`
- `w4-independent-reviews/index-0-progression-amendment-review.md`
- `w4-independent-reviews/index-1-process-failure.md`
- `w4-independent-reviews/index-2-*.md` through the final pinned index review
- per-attempt manifests and frozen score JSON files under
  `/private/tmp/leo-dev-w4-20260916/`

## 8. W4 product-quality results

### 8.1 Per-case requirement matrix

- For `HOLD-R1`, show requirements 1–11 per eligible attempt, including the
  persistence-failure boundary in requirement 8.
- For `HOLD-F1`, show the approved requirements per eligible attempt, including
  the invalid duplicate/final-record semantics and any valid interpretation
  qualifications pinned by review.
- Distinguish frozen scorer status from independent product verdict and identify
  false acceptances or false rejections without changing raw scores.

Evidence:

- `w4-evaluation-checklist.md`
- each pinned `w4-independent-reviews/index-*.md`
- `w4-independent-reviews/index-2-root-counterexample.json`
- frozen score JSON files

### 8.2 Old/new paired comparison

- For each of the six pair IDs, show both members side by side.
- Compare only independently established product outcomes and disclosed process
  measures.
- Report incomplete pairs as incomplete; do not impute an outcome.
- Do not rank old/new Leo from an unscored pair or from process-only evidence.

Evidence:

- `w4-frozen-summary.json`
- `w4-current-results.json`
- pinned attempt reviews grouped by `pairId`

### 8.3 Comparator comparison

- Compare Native, Superpowers, full cc-sdd, full Spec Kit, and full BMAD only on
  their scheduled case(s).
- Avoid treating a single-case comparator result as cross-case reliability.
- Preserve framework-specific method-use evidence and avoid imposing one
  framework's ceremony on another.

Evidence:

- comparator attempt manifests, traces, scores, and pinned reviews
- staged comparator package identities and isolation locks

## 9. W4 process-quality results

- Summarize actual method consumption, reviewer independence, substantive
  findings, fix/re-review loops, controller/Gate binding where applicable,
  protected-input preservation, final-answer accuracy, and retained command
  errors.
- Separate manager-only resumption from writer interruption/recovery.
- Record child overlap, terminal child state, process-group cleanup, and whether
  source changed after resume.
- Do not credit bundled resources that were merely available but unread.

Evidence:

- per-attempt events and manifests
- pinned independent reviews
- controller receipts and verification records inside each staged consumer
- `w4-evaluation-checklist.md`

## 10. Runtime, token, and cost evidence

- Report elapsed time against the fixed 1,800-second attempt limit.
- Use last retained cumulative counters per thread; label them as host counters,
  not automatically billable tokens.
- Report monetary cost as unknown unless independently supplied.
- Compare resource use descriptively; do not infer efficiency from product-
  rejected, unscored, or operationally failed attempts without qualification.

Evidence:

- per-attempt manifests
- `w1-execution-metrics.json`
- `w2-execution-metrics.json`
- pinned independent reviews

## 11. Cross-wave synthesis

Reserve this section for conclusions after every W4 disposition is pinned.
Structure the later synthesis around:

- product outcomes by case and configuration;
- process findings that caused, found, or missed concrete defects;
- which W2/W3 changes are exercised in W4;
- differences between raw scorer results and independent review;
- evidence-supported method-retention decisions;
- the smallest next experiments justified by measured failures.

Do not add a global winner, causal claim, model recommendation, RAG
recommendation, or multi-agent recommendation without repeated measured
evidence that supports it.

## 12. Limitations and comparability

- Small fixed case set and one attempt per frozen schedule entry.
- No general reliability estimate or causal framework effect.
- Two W4 attempts are permanently unscored and product unverified.
- W4 resumed after a host sleep/wake and TLS boundary. Current global AGENTS
  bytes predate index 0, but historical byte identity is not attested; do not
  claim instructions or skill configuration changed across the pause.
- Host-reported provider/model metadata and unknown effective child identities.
- Unknown monetary cost.
- macOS tested environment; no Linux or general cross-platform parity claim.
- Board acceptance depended on an escalated host run after default-environment
  `listen EPERM`.
- Installed-board metadata did not capture atime.
- Frozen oracles do not cover every approved failure path; independent review
  remains part of the disposition.
- Local controller receipt labels may be unauthenticated even when distinct host
  review turns are visible.

Evidence:

- `resume-20260917/stable-results-sections.md`
- `resume-20260917/index-1-progression-proposal-review.md`
- `resume-20260917/w4-02-1-hold-f1-new-leo-discovery/evidence-lock.json`
- `w4-installed-board/REPORT.md`
- `w4-final-package/regression-acceptance.md`
- pinned attempt reviews

## 13. Reproducibility and evidence index

- Provide immutable SHA-256 bindings for the final report, stable W1–W3
  sections, W4 schedule/freeze, package identity, result ledger, each pinned
  attempt review, regression acceptance, and board report.
- Link commands only where they help reproduce a decision boundary.
- Retain original failed or superseded evidence beside corrections; do not
  overwrite historical records.
- End with a machine-readable evidence index if the final packaging step calls
  for one.

Evidence roots:

- `verification/quality-first-benchmark-20260916/`
- `/private/tmp/leo-dev-w4-20260916/trials/`
- `/private/tmp/leo-dev-w4-20260916/scores/`
- `/private/tmp/leo-dev-w4-20260916/consumers/`
