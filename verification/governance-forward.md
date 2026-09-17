# Governance forward exercise

## Outcome

The approved local repair is admitted as Lite task `label-1` for change `orders-label`; it is intentionally stopped at admission. The only source change is the orders import from the private ledger store to the established public ledger entry. No label feature, UI cleanup, cross-module API/ownership change, receipt, approval, task claim, Gate lifecycle, commit, network call, install, or deployment was performed.

The independent material-path probe, `orders-boundary-review` / `boundary-review-1`, remains at triage with no task. Its material finding requires a scope-specific decision. Omitting the assessment and presenting a later ready-looking successor both remained `APPROVAL_REQUIRED`; neither was treated as approval.

## Commands and results

All controller commands used this exact local binary, repository, and JSON mode:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node /Users/leo/plugins/leo-dev/packages/cli/dist/index.js --repo /private/tmp/leo-dev-governance-example.1HDkm3 --json
```

| Command suffix | Result code | Process exit |
| --- | --- | --- |
| `init --change orders-label --spec spec.md` | `INITIALIZED` | 0 |
| `inspect --change orders-label` | `INSPECTED` | 0 |
| `route --change orders-label --task label-1 --gate architecture --assessment .leo-dev/runtime/orders-label/assessment-input.yaml` | `LOCAL_REMEDIATION_REQUIRED` | 7 |
| `route --change orders-label --task label-1 --gate architecture --assessment .leo-dev/runtime/orders-label/assessment-successor.yaml` | `ROUTED_LITE` | 0 |
| `init --change orders-boundary-review --spec spec.md` | `INITIALIZED` | 0 |
| `inspect --change orders-boundary-review` | `INSPECTED` | 0 |
| `route --change orders-boundary-review --task boundary-review-1 --gate architecture --assessment .leo-dev/runtime/orders-boundary-review/assessment-material.yaml` | `APPROVAL_REQUIRED` | 6 |
| `route --change orders-boundary-review --task boundary-review-1 --gate architecture` | `APPROVAL_REQUIRED` | 6 |
| `route --change orders-boundary-review --task boundary-review-1 --gate architecture --assessment .leo-dev/runtime/orders-boundary-review/assessment-later-ready.yaml` | `APPROVAL_REQUIRED` | 6 |
| `inspect --change orders-boundary-review` | `INSPECTED` | 0 |

Functional and boundary checks used the same Node binary in the fixture:

```sh
cd /private/tmp/leo-dev-governance-example.1HDkm3
/Users/leo/.nvm/versions/node/v22.22.2/bin/node --test tests/orders.test.mjs
/Users/leo/.nvm/versions/node/v22.22.2/bin/node scripts/check-boundary.mjs
```

Before the repair, the functional test passed (exit 0; 2 tests) and the boundary check failed (exit 1) with `Orders must use the existing public ledger entry, not its private store`. After the repair, both passed (exit 0); the boundary output was `PASS: fixture orders-to-ledger boundary`.

## Assessment and history evidence

`orders-label` first recorded a complete assessment with the relevant high local finding `orders-private-ledger-import` and unrelated medium `legacy-ui-label-debt`:

- [.leo-dev/changes/orders-label/assessments/7d1940ea3224e22648553f8ee904df4e9a888bd34f3e3ad9cdc562b889743ff4.yaml](/private/tmp/leo-dev-governance-example.1HDkm3/.leo-dev/changes/orders-label/assessments/7d1940ea3224e22648553f8ee904df4e9a888bd34f3e3ad9cdc562b889743ff4.yaml) — `local-remediation-required`.
- [.leo-dev/changes/orders-label/assessments/4682a4294d7b6dbf989e88aa1f1c57bd5ea5687b127d0868be316026de5c1196.yaml](/private/tmp/leo-dev-governance-example.1HDkm3/.leo-dev/changes/orders-label/assessments/4682a4294d7b6dbf989e88aa1f1c57bd5ea5687b127d0868be316026de5c1196.yaml) — successor, `ready`, names the prior fingerprint, resolves the repaired high finding with fresh `src/orders/service.mjs` evidence, and retains the unrelated UI finding.
- [.leo-dev/runtime/orders-label/journal.ndjson](/private/tmp/leo-dev-governance-example.1HDkm3/.leo-dev/runtime/orders-label/journal.ndjson) — six events: initialize prepare/commit; governance assessment prepare/commit; governance route prepare/commit. The route recorded task `label-1` revision 1 as `ready`.

`orders-boundary-review` first recorded a relevant, high, material finding `ledger-public-api-ownership-change` (no source repair was attempted):

- [.leo-dev/changes/orders-boundary-review/assessments/74a4abf529e417fecbfdab18202b30814c86229f03c75c07a3bb34be974dbaa2.yaml](/private/tmp/leo-dev-governance-example.1HDkm3/.leo-dev/changes/orders-boundary-review/assessments/74a4abf529e417fecbfdab18202b30814c86229f03c75c07a3bb34be974dbaa2.yaml) — `approval-required`.
- The omitted-assessment route created no new record and returned `APPROVAL_REQUIRED`.
- [.leo-dev/changes/orders-boundary-review/assessments/d46bd3db0f7c2f73ec2fc83a0e91f58a8f0807bcd48b051458aca23a5f97b763.yaml](/private/tmp/leo-dev-governance-example.1HDkm3/.leo-dev/changes/orders-boundary-review/assessments/d46bd3db0f7c2f73ec2fc83a0e91f58a8f0807bcd48b051458aca23a5f97b763.yaml) — a later complete, empty-findings successor with a fresh resolution evidence reference; it was nevertheless recorded as `approval-required`.
- [.leo-dev/runtime/orders-boundary-review/journal.ndjson](/private/tmp/leo-dev-governance-example.1HDkm3/.leo-dev/runtime/orders-boundary-review/journal.ndjson) — six events: initialize prepare/commit and two governance-assessment prepare/commit pairs. No route selection or task transition appears.

## Changed files

The sole application-source edit is [src/orders/service.mjs](/private/tmp/leo-dev-governance-example.1HDkm3/src/orders/service.mjs), changing only the import target to `../ledger/index.mjs`.

Controller-created fixture artifacts are `.leo-dev/changes/orders-label/{manifest.yaml,spec.yaml,tasks.yaml,assessments/7d1940ea3224e22648553f8ee904df4e9a888bd34f3e3ad9cdc562b889743ff4.yaml,assessments/4682a4294d7b6dbf989e88aa1f1c57bd5ea5687b127d0868be316026de5c1196.yaml}`, `.leo-dev/runtime/orders-label/{assessment-input.yaml,assessment-successor.yaml,journal.ndjson,snapshot.json}`, and their equivalent `orders-boundary-review` files with assessment fingerprints `74a4abf529e417fecbfdab18202b30814c86229f03c75c07a3bb34be974dbaa2` and `d46bd3db0f7c2f73ec2fc83a0e91f58a8f0807bcd48b051458aca23a5f97b763`.

## Limitations and guidance observed

- There is no standalone assessment-recording command. A `route --assessment` call records a non-ready assessment before returning its refusal, so a nonzero exit here is committed governance evidence rather than an unrecorded failed attempt.
- A fresh `inspect` is necessary between repair/recording steps because the controller binds assessments to the current subject-tree hash. Runtime assessment-input files do not themselves invalidate the candidate binding, while controller-created change projections advance the observed tree hash.
- The `route` command supplies a generic acceptance string and broad allowed path `.` for the admitted Lite task. This probe stopped before claim, controller Gate run, submission, review, or approval lifecycle as directed; it is admission evidence, not release evidence.
- The material probe confirms the documented sticky rule: after `approval-required`, neither omitted assessment nor a later ready-looking assessment supplies the required scope-specific user decision. No generic approval or receipt was invented.
