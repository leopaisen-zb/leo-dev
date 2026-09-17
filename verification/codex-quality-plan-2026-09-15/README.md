# Codex quality update planning record

Date: 2026-09-15. Scope: update the existing next-development specification and plan, and assess whether Leo Dev can be hosted by Pi or DeepSeek Harness. No product implementation, new test execution, installation, model benchmark or external publication is claimed.

## Deliverables

- [Canonical specification v1.10.0](../../.scratch/unified-development-plugin/spec.md): active Codex quality amendment; earlier approvals/history preserved.
- [Existing implementation plan](../../docs/superpowers/plans/2026-09-04-unified-development-plugin.md): Q1–Q4 for design admission, quality/fault checks, real integration/team acceptance and exact-package verification.
- [Local issue](../../.scratch/unified-development-plugin/issues/03-codex-quality-and-portability.md): ready-for-agent triage with implementation explicitly not started.
- [Harness feasibility](harness-compatibility.md): official extension surfaces, proposed ownership and untested conditions.
- [Before record](before.json), before-1.md.txt and before-2.md.txt: original document bytes/hashes and 171 protected source/configuration/test files.

## Decisions and evidence

The accepted [quality assessment](../quality-gap-2026-09-15/assessment.md) is the basis. A reused Terra/high explorer independently located two bounded code slices: decode design events, then extract the four existing design-admission decisions. It recommended keeping release-proof and transaction/recovery ownership outside that first extraction because of their broader dependencies.

Main inspected the existing specification, plan, local issue conventions, design-policy/schema, Codex team/review contracts, package scripts and CI. Current source has strict TypeScript and substantial recovery coverage. This planning turn does not convert their historical results into new candidate test evidence.

Official Pi and DeepSeek documentation establishes extension mechanisms. It does not establish a working Leo Dev adapter or model equivalence. Portability is a design boundary for this update; Codex/macOS remains the implementation priority.

## Verification status

- Planning review: first findings addressed; [focused rereview](independent-review.md) found no remaining concrete blockers.
- Document/path and protected-file checks: see [checks](checks.json); protected product files and historical document bodies are preserved.
- Product unit/integration/coverage tests: not run; document-only planning.
- Pi/DeepSeek install and runtime tests: not run.
- Publication/configuration changes: none.
