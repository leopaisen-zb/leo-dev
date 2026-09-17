# Quality-first workflow evaluation

The scheduled W1–W4 development and evaluation work is complete. The retained
design-repair change, read-only connected board, exact installed package and
applicable regressions passed their bounded checks. Broad workflow-quality
acceptance remains unestablished: W4 includes rejected products and two
permanently unscored attempts. No daily plugin cache or remote repository was
updated.

Read the [English report](REPORT.md) for the comparison and recommended next
work. The [final W4 ledger](w4-current-results.json) retains all 22 attempts:
20 scored, ten products accepted, ten rejected, and two unverified. One rejected
product is the unchanged BMAD seed after a required permission checkpoint;
that attempt did not reach implementation. These small local cases do not
establish a framework ranking or broad project reliability.

## Delivery and evidence

- [W1 conclusions](w1-conclusions.md): the six configurations and original
  development-case findings.
- [W2 selection](w2-selection.md): retain A's same-change design repair;
  preserve B's optional closeout methods as an experiment.
- [Installed board acceptance](w4-installed-board/REPORT.md) and
  [actual benchmark-board check](resume-20260917/board-index-2/CORRECTED_LAUNCHER_REPORT.md):
  real browser behavior and read-only metadata preservation.
- [Regression acceptance](w4-final-package/regression-acceptance.md): passing
  evidence for 518 distinct checks across retained runs, including the final
  25/25 board run; no later single full-suite exit-0 claim.
- [Package integrity](w4-final-integrity.json): all ten frozen pins and both
  package generations match; the durable local build matches the 1,326-file
  tested new package.
- [Independent reviews](w4-independent-reviews/) and
  [runtime metrics](w4-runtime-metrics.json): product, process, review
  corrections, elapsed time and retained host counters kept separately.
- [Durable local evidence archive](w4-evidence.tar.gz) and
  [verified content inventory](w4-evidence-archive.json): all frozen W4 inputs,
  consumer code, traces, manifests and scores. Original temporary-path
  references remain provenance; the archive preserves their relative layout.

Failed runs, original oracle scores, false objections and later review
corrections remain visible. The held-out inputs and acceptance thresholds were
not changed to rescue a result. Further workflow changes require a separately
identified candidate and fresh evaluation rather than rewriting this record.

See [progress](progress.md) for milestones and
[current W2–W4 dispositions](w2-current-dispositions.json) for scoped status.
