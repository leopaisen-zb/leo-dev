# Mochi Board development retrospective

Recorded on 2026-09-14 after the public controller accepted revision-3 M5 and entered `release-evidence`. This retrospective accompanies the actual independent verifier report and artifact; it does not itself admit the archive.

The delivered application is a single-user loopback task board with durable JSON storage, validated task operations, bounded activity history, browser filters and JSON import/export. It uses Node built-ins and static HTML/CSS/JavaScript. The implementation exercised the installed Leo Dev Codex package, real producer sessions, independent reviewers and public controller commands.

## Outcomes and corrections

- The original seven-group acceptance oracle was fixed before implementation. Its SHA-256 remained `152ab74d2ffca5632d8f75e175408cf99f97eb337e1fbcd7c39bca90e91d576e`. A user-owned draft sentinel remained byte-identical. Implementation agents did not own the oracle.
- M1 received a real rejection for null handling, calendar validation and an Origin case. M2's disclosed coordinator-injected status defect received an independent rejection even though its existing Gate passed. Repairs and later revisions retained both consumed failure counts.
- Specification v2 clarified case-insensitive title-or-notes search. Public revision preserved task IDs and history and required fresh design and task evidence; no second specification system was introduced.
- An intentionally stopped M3 writer left source for a fresh session to inspect. Its later lease expiry exposed a missing safe continuation path. A separately tested and independently reviewed public claim operation now explicitly supersedes only eligible expired pre-Gate Runs, retains allowed source and budgets, and fences the old Run. The actual retained fixture used that path. Browser focus and retry findings were repaired before acceptance.
- M4's producer was a fresh Codex session that read the installed package. Full browser checks exercised real downloads, import confirmation, invalid input/server-error recovery, keyboard/focus, literal rendering, filters, 390px layout and reduced motion. An independently reproduced Origin/Host authority bug was fixed against the actual loopback listener.
- A later actual clamshell sleep expired M5's pending review lease. Public submitted-review recovery retained its original Run, candidate and Gate; fresh reviewers assessed the recovery binding. No lease or journal was manually changed.
- Final primary and security reviewers independently found a valid future import → PATCH → invalid persisted timestamp order → restart failure. The controller formally rejected M5 and retained its failure count. A conservative revision of the implementation plan reopened the owning task under the unchanged v2 specification. The store now prevents timestamps from moving backwards and validates the complete candidate before writing. Three separately frozen regressions first failed and then passed; the original oracle was unchanged. They cover future creation, future update and a calendar-boundary time-zone offset through restart, export and re-import.
- M1–M4 passed again under revision 3. M5's integration claim made no application changes. Its aggregate Gate passed; architecture, security, NFR and primary reviews independently passed, and the public controller accepted the bound Full receipt. The primary reviewer repeated the exact original failure probe and checked invalid-candidate memory/disk preservation and queue recovery.

## Final binding

The accepted candidate hash is `0c12ac6d29531186d43cafbec9d57b10e293fbed3c3fa29f812264c5cd35616a`, with specification authority `317acc7fe064e4071001c89c1b220016d614de7812dfe7ef921b0beb3bdf8cb3`. The release proof hash is `753f0d122ece832915f383b5e113301aac0b95f36fe093472787423f81ce1006`. The final artifact is `mochi-board-0.2.0-v3.tar.gz`, SHA-256 `fd172f0bb499351cc9e2626ddb8b893dc8b278e325d51e693b88de6817892f4a`, containing thirteen regular files. The older candidate artifact and rejected reports remain preserved.

The independent local verifier separately executes all ten HTTP tests against the active source and an extracted copy of this artifact and records the actual results, commands, identity and current release binding. Archive admission must validate that report, this retrospective and the exact artifact. Local verifier evidence is distinct from GitHub Actions.

## What this changes for the workflow

A passing fixed Gate is necessary but can miss cross-feature behavior. Independent review found defects outside the original seven groups, and the repair gained a separate regression file without weakening the frozen oracle. Time and host interruption are observable state, so continuation and recovery must use explicit public operations and fresh evidence. A final integration task should verify the aggregate candidate; application repairs belong to a reopened implementation task with history retained.

The exercise establishes one actual Codex workflow and local application result. It does not measure superiority, statistical reliability, cost or speed against upstream frameworks. Other client adapters, native mobile, AI/RAG behavior, hostile-OS resilience and broader performance testing remain outside this acceptance scope. Local receipt labels record host attribution; they are not cryptographic identity authentication.
