# Workflow benchmarks and upstream reuse

Leo Dev's release checks use mature workflows as concrete references. This is a capability and evidence comparison, not a leaderboard or a claim that one model produces better software.

## What we compare

| Dimension | Reference behavior | Leo Dev acceptance target |
| --- | --- | --- |
| Requirements and planning | Spec Kit separates specification, technical planning, task generation and consistency analysis. | One canonical approved artifact set; requirement coverage and complete-plan assessment before implementation. |
| Task execution and review | Superpowers uses focused implementer sessions, task reviews and an overall review. | Real implementers and separate reviewers; recorded candidates, current evidence and dependency-aware continuation. |
| Repair and continuity | Superpowers keeps progress records and routes findings through bounded review/repair. | Preserve dirty work, fence stale leases, retain failed attempts and resume from durable state. |
| Specification convergence | Spec Kit can compare implementation with specifications and append remaining work. | Approved revisions preserve task IDs/history and require fresh evidence for every task; changes in intent retain an explicit approval boundary. |
| Task granularity | cc-sdd provides requirements-linked implementation task guidance. | Each task has a useful behavior, allowed paths, dependencies and a real project check; the final task verifies the assembled app. |
| Delivery | Upstream projects document installation, supported integrations and licenses. | A clean-checkout build, self-contained Codex bundle, installed-session evidence, English documentation and traceable notices. |

Superpowers' pinned execution method explicitly includes focused workers, task review, a final overall review and persistent progress records. Its rules are methods for the host; Leo Dev retains the user's own permission, workspace and model policies. [Pinned Superpowers execution method](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/subagent-driven-development/SKILL.md).

Spec Kit documents constitution, specification, planning, tasks, implementation and convergence commands. Its analyze resource checks ambiguity, coverage, constitution alignment and inconsistencies across the same artifacts. Leo Dev packages that selected analysis resource with an explicit host binding; it does not bundle or claim to run the entire Specify CLI. [Pinned Spec Kit workflow](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/README.md), [pinned analyze resource](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/templates/commands/analyze.md).

Selected cc-sdd requirements/design/task resources are included with their original licenses and hashes. They guide the host's analysis and task decomposition; local controller receipts own completion. [Pinned cc-sdd task guidance](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/templates/shared/settings/rules/tasks-generation.md), [packaged resource provenance](../skills/develop/references/upstream/provenance.json).

## What the release exercise must demonstrate

The [Mochi Board example](../examples/mochi-board/docs/spec-v2.md) is a real local HTTP application with durable storage, browser interactions and JSON snapshots. Acceptance is frozen before implementation and evaluated above private implementation functions. The workflow exercise includes dependent implementation, independent rejection and repair, interrupted source edits, a conservative specification revision, aggregate verification and archival evidence.

The final [release evidence summary](release-evidence.md) records passed, failed and unrun checks separately. Historical private trials are not published as current release evidence. Raw user histories and approval records are not part of this repository distribution.

This exercise establishes feasibility for the recorded source, task and host configuration. It does not establish statistical reliability, lower cost, faster completion, superiority over upstream frameworks, or acceptance on untested clients. Test counts do not measure task difficulty or review quality. Deferred native-mobile and AI/RAG acceptance are not inferred from browser success.

## Reuse boundary

Read [NOTICE](../NOTICE) for attribution and [the method binding guide](../skills/develop/references/upstream-methods.md) for exact ownership. Superpowers remains an external skill dependency. The controller is a local integrity mechanism for its own commands, not a sandbox against other processes with the same permissions.
